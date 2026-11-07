import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { Sql } from 'postgres';
import { DbService } from '../db/db.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { MediaEnvironmentService } from './media-environment.service';
import type { MediaDeletion } from './media-session.types';

type CleanupJob = {
  id: string;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string;
};

@Injectable()
export class MediaCleanupService {
  private working = false;

  constructor(
    private readonly db: DbService,
    private readonly cloud: CloudinaryService,
    private readonly environment: MediaEnvironmentService,
  ) {}

  private sql(): Sql {
    if (!this.db.client)
      throw new BadRequestException('Database is not configured');
    return this.db.client;
  }

  async queueUnused(sql: Sql, sessionId: string) {
    await sql`
      INSERT INTO media_deletions (environment, cloud_name, public_id, resource_type, next_attempt_at, retain_until)
      SELECT s.environment, u.cloud_name, u.public_id, u.resource_type,
        GREATEST(now(), u.signature_expires_at), u.signature_expires_at
      FROM media_uploads u JOIN media_sessions s ON s.id = u.session_id
      WHERE u.session_id = ${sessionId}::uuid AND NOT EXISTS (SELECT 1 FROM post_media m WHERE m.upload_id = u.id)
      ON CONFLICT (cloud_name, resource_type, public_id) DO NOTHING
    `;
  }

  async queueResource(
    tx: Sql,
    resource: {
      cloud_name: string | null;
      public_id: string;
      resource_type: MediaDeletion['resource_type'];
      media_url: string;
    },
  ) {
    const environment = this.environment.current();
    const cloudName = this.cloud.getClientConfig().cloudName;
    const storedCloud =
      resource.cloud_name ||
      resource.media_url.match(
        /^https:\/\/res\.cloudinary\.com\/([^/]+)\//,
      )?.[1];
    const namespaced = /^travel\/(production|staging|development|test)\//.test(
      resource.public_id,
    );
    const ownedEnvironment = resource.public_id.startsWith(
      `travel/${environment}/`,
    );
    const legacyProduction = !namespaced && environment === 'production';
    if (storedCloud !== cloudName || (!ownedEnvironment && !legacyProduction)) {
      throw new ConflictException(
        'Media belongs to another Cloudinary account or environment; deletion is blocked',
      );
    }
    await tx`
          INSERT INTO media_deletions (environment, cloud_name, public_id, resource_type, retain_until)
          VALUES (${environment}, ${storedCloud}, ${resource.public_id}, ${resource.resource_type},
            COALESCE((SELECT MAX(signature_expires_at) FROM media_uploads WHERE cloud_name = ${storedCloud} AND public_id = ${resource.public_id}), now()))
          ON CONFLICT (cloud_name, resource_type, public_id) DO UPDATE SET next_attempt_at = now()
        `;
  }

  async pendingCount() {
    const environment = this.environment.current();
    const [result] = await this.sql()<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM media_deletions WHERE environment = ${environment}
    `;
    return result.count;
  }

  async cleanupStatus(): Promise<{ jobs: CleanupJob[] }> {
    const environment = this.environment.current();
    const jobs = await this.sql()<CleanupJob[]>`
      SELECT id, attempts, last_error, next_attempt_at FROM media_deletions
      WHERE environment = ${environment} ORDER BY created_at LIMIT 100
    `;
    return { jobs };
  }

  async retryFailedCleanup() {
    const environment = this.environment.current();
    // Force failed jobs only; retain the safety delay for cancelled uploads.
    await this.sql()`UPDATE media_deletions SET next_attempt_at = now()
      WHERE environment = ${environment} AND last_error IS NOT NULL`;
    await this.retryCleanup();
    return this.cleanupStatus();
  }

  async retryCleanup() {
    if (this.working || !this.db.client) return;
    this.working = true;
    try {
      const sql = this.sql();
      const environment = this.environment.current();
      await sql.begin(async (transaction) => {
        const tx = transaction as unknown as Sql;
        const expired = await tx<{ id: string }[]>`
          UPDATE media_sessions SET state = 'CANCELLED' WHERE state = 'OPEN' AND expires_at <= now()
            AND environment = ${environment} RETURNING id
        `;
        for (const session of expired) await this.queueUnused(tx, session.id);
      });
      const jobs = await sql<MediaDeletion[]>`
        UPDATE media_deletions SET next_attempt_at = now() + interval '5 minutes'
        WHERE id IN (SELECT id FROM media_deletions WHERE environment = ${environment} AND next_attempt_at <= now()
          ORDER BY next_attempt_at LIMIT 10 FOR UPDATE SKIP LOCKED)
        RETURNING id, cloud_name, public_id, resource_type, attempts
      `;
      for (const job of jobs) {
        try {
          const referenced = await sql`
            SELECT 1 FROM post_media WHERE cloudinary_public_id = ${job.public_id} AND (cloud_name = ${job.cloud_name} OR cloud_name IS NULL)
            UNION ALL SELECT 1 FROM posts WHERE cloudinary_public_id = ${job.public_id}
            UNION ALL SELECT 1 FROM media_uploads u JOIN media_sessions s ON s.id = u.session_id
              WHERE u.public_id = ${job.public_id} AND u.cloud_name = ${job.cloud_name} AND s.state = 'OPEN' LIMIT 1
          `;
          if (referenced.length)
            throw new Error('Resource is still referenced; deletion postponed');
          if (this.cloud.getClientConfig().cloudName !== job.cloud_name)
            throw new Error('Cloudinary account does not match deletion job');
          await this.cloud.destroy(job.public_id, job.resource_type);
          await sql`DELETE FROM media_deletions WHERE id = ${job.id}::uuid AND retain_until <= now()`;
          await sql`UPDATE media_deletions SET next_attempt_at = retain_until, last_error = NULL WHERE id = ${job.id}::uuid`;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Cloudinary deletion failed';
          const seconds = Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7));
          await sql`UPDATE media_deletions SET attempts = attempts + 1, last_error = ${message.slice(0, 500)},
            next_attempt_at = now() + ${seconds} * interval '1 second' WHERE id = ${job.id}::uuid`;
        }
      }
    } finally {
      this.working = false;
    }
  }
}
