import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { Sql } from 'postgres';
import { DbService } from '../db/db.service';

type CloudinaryResource = {
  asset_id: string;
  public_id: string;
  resource_type: string;
  format?: string;
  secure_url?: string;
  created_at?: string;
  folder?: string;
  asset_folder?: string;
};

type ResourceType = 'image' | 'video' | 'raw';

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

function toResourceType(value: string): ResourceType {
  if (value === 'image' || value === 'video' || value === 'raw') return value;
  // Cloudinary sometimes uses "image"/"video"/"raw"; fall back to image.
  return 'image';
}

@Injectable()
export class CloudinaryService {
  private readonly isConfigured: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DbService,
  ) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    this.isConfigured = Boolean(cloudName && apiKey && apiSecret);
    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  private getSqlOrThrow(): Sql {
    if (!this.isConfigured) {
      throw new BadRequestException(
        'Cloudinary is not configured on the server',
      );
    }
    const sql = this.db.client;
    if (!sql) {
      throw new BadRequestException('Database is not configured on the server');
    }
    return sql;
  }

  private buildMediaUrl(resource: CloudinaryResource): string | null {
    const url = (resource.secure_url ?? '').trim();
    if (url) return url;
    // Some Admin API responses don't include secure_url.
    // We can still build a delivery URL from config + public_id.
    try {
      return cloudinary.url(resource.public_id, {
        secure: true,
        resource_type: toResourceType(resource.resource_type),
        type: 'upload',
      });
    } catch {
      return null;
    }
  }

  private async listByAssetFolder(params: {
    assetFolder: string;
    resourceType: ResourceType;
    maxResults: number;
    nextCursor?: string;
  }): Promise<{ resources: CloudinaryResource[]; next_cursor?: string }> {
    // Cloudinary DAM uses "asset folders" (Media Library folders).
    const resUnknown: unknown = await (cloudinary.api as unknown as {
      resources_by_asset_folder: (
        assetFolder: string,
        options: Record<string, unknown>,
      ) => Promise<unknown>;
    }).resources_by_asset_folder(params.assetFolder, {
      type: 'upload',
      resource_type: params.resourceType,
      max_results: params.maxResults,
      next_cursor: params.nextCursor,
    });

    return resUnknown as {
      resources: CloudinaryResource[];
      next_cursor?: string;
    };
  }

  private async listSubFoldersBfs(params: {
    root: string;
    maxFolders?: number;
  }): Promise<string[]> {
    // Returns folder paths including the root itself.
    const root = stripTrailingSlashes(params.root);
    const maxFolders = Math.max(1, Math.min(2000, params.maxFolders ?? 500));

    const seen = new Set<string>();
    const out: string[] = [];
    const queue: string[] = [root];

    while (queue.length > 0 && out.length < maxFolders) {
      const cur = queue.shift();
      if (!cur) break;
      if (seen.has(cur)) continue;
      seen.add(cur);
      out.push(cur);

      let resUnknown: unknown;
      try {
        resUnknown = (await cloudinary.api.sub_folders(cur)) as unknown;
      } catch {
        // If sub_folders isn't available for this path, just stop descending.
        continue;
      }

      const res = resUnknown as { folders?: Array<{ path?: string }> };
      for (const f of res.folders ?? []) {
        const p = typeof f.path === 'string' ? f.path : null;
        if (!p) continue;
        const normalized = stripTrailingSlashes(p);
        if (!seen.has(normalized)) queue.push(normalized);
        if (out.length + queue.length >= maxFolders) break;
      }
    }

    return out;
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
      const mediaUrl = this.buildMediaUrl(r);
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
      const createdAt = r.created_at ? new Date(r.created_at) : new Date();

      try {
        const rows = await sql<{ id: string }[]>`
          INSERT INTO posts (
            user_id, media_type, media_url, cloudinary_public_id, folder, country, city, created_at
          )
          VALUES (
            ${params.userId}::uuid,
            ${mediaType},
            ${mediaUrl},
            ${r.public_id},
            ${folder},
            ${country},
            ${city},
            ${createdAt.toISOString()}
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
    const foldersToImport = await this.listSubFoldersBfs({
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
            res = await this.listByAssetFolder({
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

    return { prefix: prefixInput, scanned, inserted, errors: errors.slice(0, 50) };
  }

  async probePrefix(params: { prefix: string }) {
    if (!this.isConfigured) {
      throw new BadRequestException(
        'Cloudinary is not configured on the server',
      );
    }
    const prefix = params.prefix.trim();
    const folder = prefix ? stripTrailingSlashes(prefix) : null;

    let ping: unknown = null;
    try {
      ping = (await cloudinary.api.ping()) as unknown;
    } catch (e) {
      ping = { error: (e as Error).message };
    }

    let rootFolders: unknown = null;
    try {
      rootFolders = (await cloudinary.api.root_folders()) as unknown;
    } catch (e) {
      rootFolders = { error: (e as Error).message };
    }

    let subFolders: unknown = null;
    if (folder) {
      try {
        subFolders = (await cloudinary.api.sub_folders(folder)) as unknown;
      } catch (e) {
        subFolders = { error: (e as Error).message };
      }
    }

    return {
      prefix: folder,
      ping,
      root_folders: rootFolders,
      sub_folders: folder ? { folder, result: subFolders } : null,
    };
  }
}
