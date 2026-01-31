import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { createHash } from 'crypto';
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

/** Парсит GPS из формата Cloudinary EXIF: "13 deg 45' 10.78\" N" → десятичные градусы. */
function parseGpsCoord(value: string | undefined): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const m = value.trim().match(/(\d+)\s*deg\s*(\d+)'\s*([\d.]+)"\s*([NSEW])/i);
  if (!m) return null;
  const [, d, min, sec, dir] = m;
  const deg = parseInt(d ?? '0', 10);
  const minVal = parseInt(min ?? '0', 10) / 60;
  const secVal = parseFloat(sec ?? '0') / 3600;
  let dec = deg + minVal + secVal;
  if ((dir ?? '').toUpperCase() === 'S' || (dir ?? '').toUpperCase() === 'W')
    dec = -dec;
  return Math.round(dec * 1e7) / 1e7;
}

/** Парсит дату съёмки: "2026:01:19 13:18:00" (локаль + offset) или "UTC 2026-01-23 03:09:16". */
function parseShotDate(
  dateStr: string | undefined,
  offsetStr?: string | null,
): Date | null {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return null;
  const normalized = dateStr.replace(/-/g, ':').trim();
  const m = normalized.match(
    /(?:UTC\s+)?(\d{4}):(\d{2}):(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})/,
  );
  if (!m) return null;
  const [, y, mo, d, h, min, sec] = m;
  let offsetMinutes = 0;
  if (typeof offsetStr === 'string' && offsetStr.trim()) {
    const om = offsetStr.trim().match(/^([+-])(\d{2}):(\d{2})$/);
    if (om) {
      const sign = om[1] === '+' ? 1 : -1;
      offsetMinutes = sign * (parseInt(om[2], 10) * 60 + parseInt(om[3], 10));
    }
  }
  const date = new Date(
    Date.UTC(
      parseInt(y ?? '0', 10),
      parseInt(mo ?? '0', 10) - 1,
      parseInt(d ?? '0', 10),
      parseInt(h ?? '0', 10),
      parseInt(min ?? '0', 10),
      parseInt(sec ?? '0', 10),
    ),
  );
  if (offsetMinutes !== 0) {
    date.setTime(date.getTime() - offsetMinutes * 60 * 1000);
  }
  return date;
}

export type ResourceMetadata = {
  lat: number | null;
  lng: number | null;
  shotAt: Date | null;
};

@Injectable()
export class CloudinaryService {
  private readonly isConfigured: boolean;
  private readonly cloudName: string | null;
  private readonly apiKey: string | null;
  private readonly apiSecret: string | null;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DbService,
  ) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME') ?? null;
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY') ?? null;
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET') ?? null;

    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;

    this.isConfigured = Boolean(cloudName && apiKey && apiSecret);
    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  getClientConfig() {
    if (!this.isConfigured || !this.cloudName || !this.apiKey) {
      throw new BadRequestException(
        'Cloudinary is not configured on the server',
      );
    }
    return { cloudName: this.cloudName, apiKey: this.apiKey };
  }

  signUpload(paramsToSign: Record<string, unknown> | null | undefined) {
    if (!this.isConfigured || !this.apiSecret) {
      throw new BadRequestException(
        'Cloudinary is not configured on the server',
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const input = paramsToSign ?? {};
    // Cloudinary signature: sort params, join "k=v" with "&", append api_secret, sha1.
    const entries: Array<[string, string]> = [];
    for (const [k, v] of Object.entries(input)) {
      if (v === null || v === undefined) continue;
      if (k === 'file' || k === 'signature' || k === 'api_key') continue;
      if (k === 'timestamp') continue; // server will set
      const s =
        typeof v === 'string'
          ? v
          : typeof v === 'number' || typeof v === 'boolean'
            ? String(v)
            : '';
      if (!s.trim()) continue;
      entries.push([k, s]);
    }
    entries.push(['timestamp', String(timestamp)]);
    entries.sort((a, b) => a[0].localeCompare(b[0]));

    const toSign = entries.map(([k, v]) => `${k}=${v}`).join('&');
    const signature = createHash('sha1')
      .update(`${toSign}${this.apiSecret}`, 'utf8')
      .digest('hex');

    return { signature, timestamp };
  }

  /** Delete asset from Cloudinary by public_id. resourceType: 'image' | 'video' | 'raw'. */
  async destroy(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw',
  ): Promise<void> {
    if (!this.isConfigured) {
      throw new BadRequestException(
        'Cloudinary is not configured on the server',
      );
    }
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
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
    const resUnknown: unknown = await (
      cloudinary.api as unknown as {
        resources_by_asset_folder: (
          assetFolder: string,
          options: Record<string, unknown>,
        ) => Promise<unknown>;
      }
    ).resources_by_asset_folder(params.assetFolder, {
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

  /**
   * Запрашивает у Cloudinary метаданные ресурса (EXIF/видео) и возвращает
   * координаты и дату съёмки, если они есть.
   */
  async getResourceMetadata(
    publicId: string,
    resourceType: ResourceType,
  ): Promise<ResourceMetadata> {
    const out: ResourceMetadata = { lat: null, lng: null, shotAt: null };
    if (!this.isConfigured) return out;
    let raw: unknown;
    try {
      raw = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
        media_metadata: true,
      });
    } catch {
      return out;
    }
    const res = raw as Record<string, unknown>;
    if (resourceType === 'image') {
      const meta = res.media_metadata as Record<string, unknown> | undefined;
      if (meta) {
        const lat = parseGpsCoord(meta.GPSLatitude as string | undefined);
        const lng = parseGpsCoord(meta.GPSLongitude as string | undefined);
        if (lat != null) out.lat = lat;
        if (lng != null) out.lng = lng;
        const dateStr =
          (meta.DateTimeOriginal as string) ??
          (meta.CreateDate as string) ??
          (meta.ModifyDate as string);
        const offset =
          (meta.OffsetTimeOriginal as string) ??
          (meta.OffsetTimeDigitized as string) ??
          (meta.OffsetTime as string);
        const shot = parseShotDate(
          dateStr as string | undefined,
          offset as string | undefined,
        );
        if (shot) out.shotAt = shot;
      }
    } else if (resourceType === 'video') {
      const dateStr =
        (res.encoded_date as string) ?? (res.tagged_date as string);
      const shot = parseShotDate(dateStr);
      if (shot) out.shotAt = shot;
      const videoMeta = res.video_metadata as
        | Record<string, unknown>
        | undefined;
      const video = videoMeta?.video as Record<string, unknown> | undefined;
      const vMeta = video?.metadata as Record<string, unknown> | undefined;
      if (vMeta?.encoded_date) {
        const s = parseShotDate(vMeta.encoded_date as string);
        if (s) out.shotAt = s;
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
      const rt: ResourceType = toResourceType(r.resource_type);

      let createdAt = r.created_at ? new Date(r.created_at) : new Date();
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const meta = await this.getResourceMetadata(r.public_id, rt);
        if (meta.shotAt) createdAt = meta.shotAt;
        if (meta.lat != null) lat = meta.lat;
        if (meta.lng != null) lng = meta.lng;
      } catch {
        // Оставляем created_at из Cloudinary, lat/lng null
      }

      try {
        const rows = await sql<{ id: string }[]>`
          INSERT INTO posts (
            user_id, media_type, media_url, cloudinary_public_id, folder, country, city, lat, lng, created_at
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

    return {
      prefix: prefixInput,
      scanned,
      inserted,
      errors: errors.slice(0, 50),
    };
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
