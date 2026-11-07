import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { createHash } from 'crypto';
import {
  asPositiveDimension,
  parseGpsCoord,
  parseShotDate,
  type ResourceMetadata,
} from './cloudinary-metadata';
import {
  type CloudinaryResource,
  type ResourceType,
  toResourceType,
} from './cloudinary.types';

@Injectable()
export class CloudinaryService {
  private readonly isConfigured: boolean;
  private readonly cloudName: string | null;
  private readonly apiKey: string | null;
  private readonly apiSecret: string | null;

  constructor(private readonly config: ConfigService) {
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

    const input = paramsToSign ?? {};
    const inputTimestamp = input.timestamp;
    const timestamp =
      typeof inputTimestamp === 'number' || typeof inputTimestamp === 'string'
        ? String(inputTimestamp)
        : String(Math.floor(Date.now() / 1000));

    // Cloudinary signature: sort params, join "k=v" with "&", append api_secret, sha1.
    const entries: Array<[string, string]> = [];
    for (const [k, v] of Object.entries(input)) {
      if (v === null || v === undefined) continue;
      if (k === 'file' || k === 'signature' || k === 'api_key') continue;
      if (k === 'timestamp') continue;
      const s =
        typeof v === 'string'
          ? v
          : typeof v === 'number' || typeof v === 'boolean'
            ? String(v)
            : '';
      if (!s.trim()) continue;
      entries.push([k, s]);
    }
    entries.push(['timestamp', timestamp]);
    entries.sort((a, b) => a[0].localeCompare(b[0]));

    const toSign = entries.map(([k, v]) => `${k}=${v}`).join('&');
    const signature = createHash('sha1')
      .update(`${toSign}${this.apiSecret}`, 'utf8')
      .digest('hex');

    return { signature, timestamp: Number(timestamp) };
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
    const result: unknown = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    const status = (result as { result?: string })?.result;
    if (status !== 'ok' && status !== 'not found') {
      throw new ServiceUnavailableException(
        'Cloudinary did not confirm deletion',
      );
    }
  }

  async getUploadResource(publicId: string, resourceType: 'image' | 'video') {
    this.getClientConfig();
    try {
      const result: unknown = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
        ...(resourceType === 'video' ? { media_metadata: true } : {}),
      });
      return result as {
        public_id: string;
        resource_type: string;
        secure_url: string;
        format: string;
        bytes: number;
        width: number;
        height: number;
        duration: number;
      };
    } catch (error) {
      if (
        (error as { error?: { http_code?: number }; http_code?: number })?.error
          ?.http_code === 404 ||
        (error as { http_code?: number })?.http_code === 404
      )
        return null;
      throw new ServiceUnavailableException(
        'Could not verify the uploaded file; retry',
      );
    }
  }

  buildMediaUrl(resource: CloudinaryResource): string | null {
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

  /**
   * Запрашивает у Cloudinary метаданные ресурса (EXIF/видео) и возвращает
   * координаты и дату съёмки, если они есть.
   */
  async getResourceMetadata(
    publicId: string,
    resourceType: ResourceType,
  ): Promise<ResourceMetadata> {
    const out: ResourceMetadata = {
      lat: null,
      lng: null,
      shotAt: null,
      width: null,
      height: null,
    };
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
    out.width = asPositiveDimension(res.width);
    out.height = asPositiveDimension(res.height);
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
        const shot = parseShotDate(dateStr, offset);
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
}
