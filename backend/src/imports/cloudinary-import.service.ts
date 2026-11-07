import { BadRequestException, Injectable } from '@nestjs/common';
import type { Sql } from 'postgres';
import { DbService } from '../db/db.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { CloudinaryCatalogService } from '../integrations/cloudinary/cloudinary-catalog.service';
import { dimensionsFromValues } from '../integrations/cloudinary/cloudinary-metadata';
import {
  type CloudinaryResource,
  type ResourceType,
  toResourceType,
} from '../integrations/cloudinary/cloudinary.types';

function pickMediaType(
  resource: CloudinaryResource,
): 'PHOTO' | 'VIDEO' | 'AUDIO' {
  if (resource.resource_type === 'image') return 'PHOTO';
  if (resource.resource_type === 'video') {
    const fmt = (resource.format ?? '').toLowerCase();
    const audioFormats = new Set([
      'mp3',
      'm4a',
      'wav',
      'aac',
      'ogg',
      'flac',
      'opus',
    ]);
    if (audioFormats.has(fmt)) return 'AUDIO';
    return 'VIDEO';
  }
  // Default fallback
  return 'PHOTO';
}

function deriveFolder(resource: CloudinaryResource): string | null {
  if (resource.folder) return resource.folder;
  if (resource.asset_folder) return resource.asset_folder;
  const idx = resource.public_id.lastIndexOf('/');
  if (idx === -1) return null;
  return resource.public_id.slice(0, idx);
}

function deriveCountryCity(folder: string | null): {
  country: string | null;
  city: string | null;
} {
  if (!folder) return { country: null, city: null };
  const parts = folder.split('/').filter(Boolean);
  // expected: tapir/<country>/<city>/...
  const country = parts.length >= 2 ? parts[1] : null;
  const city = parts.length >= 3 ? parts[2] : null;
  return { country, city };
}

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/g, '');
}

@Injectable()
export class CloudinaryImportService {
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

  async importPrefix(params: { prefix: string; userId: string; max?: number }) {
    const sql = this.getSqlOrThrow();

    const prefixInput = params.prefix.trim();
    if (!prefixInput) throw new BadRequestException('prefix is required');

    const max = Math.max(1, Math.min(10000, params.max ?? 2000));

    let scanned = 0;
    let inserted = 0;
    const errors: Array<{
      stage: 'list' | 'insert';
      folder?: string;
      resource_type?: ResourceType;
      source?: 'resources_by_asset_folder';
      public_id?: string;
      message: string;
    }> = [];

    const safeInsert = async (r: CloudinaryResource) => {
      // Reserved files include unfinished uploads and every carousel attachment.
      // They must never be imported again as independent posts.
      const reserved = await sql`
        SELECT 1 FROM post_media WHERE cloudinary_public_id = ${r.public_id}
        UNION ALL SELECT 1 FROM media_uploads WHERE public_id = ${r.public_id}
        UNION ALL SELECT 1 FROM media_deletions WHERE public_id = ${r.public_id}
        LIMIT 1
      `;
      if (reserved.length) return;
      const mediaUrl = this.cloud.buildMediaUrl(r);
      if (!mediaUrl) {
        errors.push({
          stage: 'insert',
          public_id: r.public_id,
          message: 'Missing media URL (secure_url not provided)',
        });
        return;
      }

      const folder = deriveFolder(r);
      const { country, city } = deriveCountryCity(folder);
      const mediaType = pickMediaType(r);
      const rt: ResourceType = toResourceType(r.resource_type);

      let createdAt = r.created_at ? new Date(r.created_at) : new Date();
      let lat: number | null = null;
      let lng: number | null = null;
      let dimensions = dimensionsFromValues(r.width, r.height);
      try {
        const meta = await this.cloud.getResourceMetadata(r.public_id, rt);
        if (meta.shotAt) createdAt = meta.shotAt;
        if (meta.lat != null) lat = meta.lat;
        if (meta.lng != null) lng = meta.lng;
        dimensions ??= dimensionsFromValues(meta.width, meta.height);
      } catch {
        // Оставляем created_at из Cloudinary, lat/lng null
      }

      try {
        const rows = await sql<{ id: string }[]>`
          INSERT INTO posts (
            user_id, media_type, media_url, cloudinary_public_id, folder, country, city, lat, lng, created_at, media_width, media_height
          )
          VALUES (
            ${params.userId}::uuid,
            ${mediaType},
            ${mediaUrl},
            ${r.public_id},
            ${folder},
            ${country},
            ${city},
            ${lat},
            ${lng},
            ${createdAt.toISOString()},
            ${dimensions?.width ?? null},
            ${dimensions?.height ?? null}
          )
          -- Our DB uses a PARTIAL unique index:
          --   posts_cloudinary_public_id_unique ON (cloudinary_public_id) WHERE cloudinary_public_id IS NOT NULL
          -- For Postgres to use that index for conflict resolution, the conflict target must repeat the predicate.
          ON CONFLICT (cloudinary_public_id) WHERE cloudinary_public_id IS NOT NULL DO NOTHING
          RETURNING id
        `;
        if (rows.length > 0) inserted += 1;
      } catch (e) {
        errors.push({
          stage: 'insert',
          public_id: r.public_id,
          message: (e as Error)?.message ?? 'DB insert failed',
        });
      }
    };

    const resourceTypes: ResourceType[] = ['image', 'video', 'raw'];
    const rootFolder = stripTrailingSlashes(prefixInput);

    // Import by folder tree (this matches your Cloudinary Media Library structure).
    const foldersToImport = await this.catalog.listSubFoldersBfs({
      root: rootFolder,
      maxFolders: 500,
    });

    for (const folderPath of foldersToImport) {
      if (scanned >= max) break;

      for (const rt of resourceTypes) {
        if (scanned >= max) break;

        let nextCursor: string | undefined;
        while (scanned < max) {
          let res: { resources: CloudinaryResource[]; next_cursor?: string };
          try {
            res = await this.catalog.listByAssetFolder({
              assetFolder: folderPath,
              resourceType: rt,
              maxResults: 500,
              nextCursor,
            });
          } catch (e) {
            errors.push({
              stage: 'list',
              folder: folderPath,
              resource_type: rt,
              source: 'resources_by_asset_folder',
              message:
                (e as Error)?.message ?? 'resources_by_asset_folder failed',
            });
            break;
          }

          for (const r of res.resources) {
            scanned += 1;
            await safeInsert(r);
            if (scanned >= max) break;
          }

          nextCursor = res.next_cursor;
          if (!nextCursor) break;
        }
      }
    }

    return {
      prefix: prefixInput,
      scanned,
      inserted,
      errors: errors.slice(0, 50),
    };
  }
}
