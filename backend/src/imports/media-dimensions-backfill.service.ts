import { BadRequestException, Injectable } from '@nestjs/common';
import type { Sql } from 'postgres';
import { DbService } from '../db/db.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { CloudinaryCatalogService } from '../integrations/cloudinary/cloudinary-catalog.service';
import { dimensionsFromValues } from '../integrations/cloudinary/cloudinary-metadata';
import type { CloudinaryResource } from '../integrations/cloudinary/cloudinary.types';

@Injectable()
export class MediaDimensionsBackfillService {
  constructor(
    private readonly db: DbService,
    private readonly cloud: CloudinaryService,
    private readonly catalog: CloudinaryCatalogService,
  ) {}

  private getSqlOrThrow(): Sql {
    this.cloud.getClientConfig();
    const sql = this.db.client;
    if (!sql) {
      throw new BadRequestException('Database is not configured on the server');
    }
    return sql;
  }

  async backfillMediaDimensions(params?: { max?: number }) {
    const sql = this.getSqlOrThrow();
    // Cloudinary accepts at most 100 public IDs in one Admin API batch.
    // Keeping one database batch within that limit turns thousands of per-file
    // requests into a few dozen API calls.
    const max = Math.max(1, Math.min(100, params?.max ?? 100));
    const rows = await sql<
      Array<{ id: string; cloudinary_public_id: string; media_type: string }>
    >`
      SELECT id, cloudinary_public_id, media_type
      FROM posts
      WHERE
        media_type IN ('PHOTO', 'VIDEO')
        AND cloudinary_public_id IS NOT NULL
        AND (media_width IS NULL OR media_height IS NULL)
        AND media_dimensions_checked_at IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT ${max}
    `;

    const resourcesByPublicId = new Map<string, CloudinaryResource>();
    for (const resourceType of ['image', 'video'] as const) {
      const publicIds = rows
        .filter((row) =>
          resourceType === 'video'
            ? row.media_type === 'VIDEO'
            : row.media_type === 'PHOTO',
        )
        .map((row) => row.cloudinary_public_id);
      if (publicIds.length === 0) continue;

      const resources = await this.catalog.resourcesByIds(
        publicIds,
        resourceType,
      );
      for (const resource of resources) {
        resourcesByPublicId.set(resource.public_id, resource);
      }
    }

    let updated = 0;
    let unavailable = 0;
    for (const row of rows) {
      const resource = resourcesByPublicId.get(row.cloudinary_public_id);
      const dimensions = dimensionsFromValues(
        resource?.width,
        resource?.height,
      );
      await sql`
        UPDATE posts
        SET
          media_width = COALESCE(${dimensions?.width ?? null}, media_width),
          media_height = COALESCE(${dimensions?.height ?? null}, media_height),
          media_dimensions_checked_at = now()
        WHERE id = ${row.id}::uuid
          AND (media_width IS NULL OR media_height IS NULL)
      `;
      if (dimensions) updated += 1;
      else unavailable += 1;
    }

    return {
      scanned: rows.length,
      updated,
      unavailable,
      hasMore: rows.length === max,
    };
  }

  async resetMediaDimensionsBackfill() {
    const sql = this.getSqlOrThrow();
    const rows = await sql<Array<{ id: string }>>`
      UPDATE posts
      SET media_dimensions_checked_at = NULL
      WHERE
        media_type IN ('PHOTO', 'VIDEO')
        AND (media_width IS NULL OR media_height IS NULL)
        AND media_dimensions_checked_at IS NOT NULL
      RETURNING id
    `;
    return { reset: rows.length };
  }
}
