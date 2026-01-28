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
  secure_url: string;
  created_at?: string;
  folder?: string;
};

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

  async importPrefix(params: { prefix: string; userId: string; max?: number }) {
    const sql = this.getSqlOrThrow();

    const prefix = params.prefix.trim();
    if (!prefix) throw new BadRequestException('prefix is required');

    const max = Math.max(1, Math.min(10000, params.max ?? 2000));

    let nextCursor: string | undefined;
    let scanned = 0;
    let inserted = 0;

    while (scanned < max) {
      const resUnknown: unknown = await cloudinary.api.resources({
        type: 'upload',
        prefix,
        resource_type: 'image',
        max_results: 500,
        next_cursor: nextCursor,
      });
      const res = resUnknown as {
        resources: CloudinaryResource[];
        next_cursor?: string;
      };

      for (const r of res.resources) {
        scanned += 1;
        const folder = deriveFolder(r);
        const { country, city } = deriveCountryCity(folder);
        const mediaType = pickMediaType(r);
        const createdAt = r.created_at ? new Date(r.created_at) : new Date();

        const rows = await sql<{ id: string }[]>`
          INSERT INTO posts (
            user_id, media_type, media_url, cloudinary_public_id, folder, country, city, created_at
          )
          VALUES (
            ${params.userId}::uuid,
            ${mediaType},
            ${r.secure_url},
            ${r.public_id},
            ${folder},
            ${country},
            ${city},
            ${createdAt.toISOString()}
          )
          ON CONFLICT (cloudinary_public_id) DO NOTHING
          RETURNING id
        `;
        if (rows.length > 0) inserted += 1;

        if (scanned >= max) break;
      }

      nextCursor = res.next_cursor;
      if (!nextCursor) break;
    }

    // Also import videos (Cloudinary treats audio mostly as resource_type=video too)
    nextCursor = undefined;
    while (scanned < max) {
      const resUnknown: unknown = await cloudinary.api.resources({
        type: 'upload',
        prefix,
        resource_type: 'video',
        max_results: 500,
        next_cursor: nextCursor,
      });
      const res = resUnknown as {
        resources: CloudinaryResource[];
        next_cursor?: string;
      };

      for (const r of res.resources) {
        scanned += 1;
        const folder = deriveFolder(r);
        const { country, city } = deriveCountryCity(folder);
        const mediaType = pickMediaType(r);
        const createdAt = r.created_at ? new Date(r.created_at) : new Date();

        const rows = await sql<{ id: string }[]>`
          INSERT INTO posts (
            user_id, media_type, media_url, cloudinary_public_id, folder, country, city, created_at
          )
          VALUES (
            ${params.userId}::uuid,
            ${mediaType},
            ${r.secure_url},
            ${r.public_id},
            ${folder},
            ${country},
            ${city},
            ${createdAt.toISOString()}
          )
          ON CONFLICT (cloudinary_public_id) DO NOTHING
          RETURNING id
        `;
        if (rows.length > 0) inserted += 1;

        if (scanned >= max) break;
      }

      nextCursor = res.next_cursor;
      if (!nextCursor) break;
    }

    return { prefix, scanned, inserted };
  }

  async probePrefix(params: { prefix: string }) {
    if (!this.isConfigured) {
      throw new BadRequestException(
        'Cloudinary is not configured on the server',
      );
    }
    const prefix = params.prefix.trim();
    if (!prefix) throw new BadRequestException('prefix is required');

    const imageResUnknown: unknown = await cloudinary.api.resources({
      type: 'upload',
      prefix,
      resource_type: 'image',
      max_results: 5,
    });
    const videoResUnknown: unknown = await cloudinary.api.resources({
      type: 'upload',
      prefix,
      resource_type: 'video',
      max_results: 5,
    });

    const imageRes = imageResUnknown as { resources: CloudinaryResource[] };
    const videoRes = videoResUnknown as { resources: CloudinaryResource[] };

    return {
      prefix,
      images_found: imageRes.resources.length,
      videos_found: videoRes.resources.length,
      sample_public_ids: [
        ...imageRes.resources.slice(0, 5).map((r) => r.public_id),
        ...videoRes.resources.slice(0, 5).map((r) => r.public_id),
      ],
      sample_folders: [
        ...imageRes.resources.slice(0, 5).map((r) => r.folder ?? null),
        ...videoRes.resources.slice(0, 5).map((r) => r.folder ?? null),
      ],
    };
  }
}
