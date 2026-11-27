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
  type CloudinaryCredentials,
  type CloudinaryResource,
  type ResourceType,
  toResourceType,
} from './cloudinary.types';

function cloudinaryStatus(error: unknown) {
  const response = error as
    | { http_code?: number; error?: { http_code?: number } }
    | undefined;
  return response?.http_code ?? response?.error?.http_code;
}

function cloudinaryFailure(status: number | undefined, message: string) {
  return new ServiceUnavailableException(
    status === 401 || status === 403
      ? 'Cloudinary denied access; check the credentials for the original cloud'
      : message,
  );
}

@Injectable()
export class CloudinaryService {
  private readonly appCredentials: CloudinaryCredentials | null;

  constructor(config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');
    this.appCredentials =
      cloudName && apiKey && apiSecret
        ? { cloudName, apiKey, apiSecret }
        : null;

    if (this.appCredentials) {
      cloudinary.config({
        ...this.sdkOptions(this.appCredentials),
        secure: true,
      });
    }
  }

  private requireCredentials(credentials = this.appCredentials) {
    if (!credentials) {
      throw new BadRequestException(
        'Cloudinary is not configured on the server',
      );
    }
    return credentials;
  }

  private sdkOptions(credentials?: CloudinaryCredentials) {
    const { cloudName, apiKey, apiSecret } =
      this.requireCredentials(credentials);
    return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
  }

  getClientConfig(credentials?: CloudinaryCredentials) {
    const { cloudName, apiKey } = this.requireCredentials(credentials);
    return { cloudName, apiKey };
  }

  signUpload(
    paramsToSign: Record<string, unknown> | null | undefined,
    credentials?: CloudinaryCredentials,
  ) {
    const { apiSecret } = this.requireCredentials(credentials);
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
      .update(`${toSign}${apiSecret}`, 'utf8')
      .digest('hex');

    return { signature, timestamp: Number(timestamp) };
  }

  async getFolderMode(
    credentials?: CloudinaryCredentials,
  ): Promise<'dynamic' | 'fixed'> {
    const message = 'Не удалось определить режим папок в Cloudinary';
    const options = this.sdkOptions(credentials);
    const result = await cloudinary.api
      .config({ ...options, settings: true, timeout: 5_000 })
      .catch((error: unknown) => {
        throw cloudinaryFailure(cloudinaryStatus(error), message);
      });
    const mode = (result as { settings?: { folder_mode?: unknown } }).settings
      ?.folder_mode;
    if (mode === 'dynamic' || mode === 'fixed') return mode;
    throw cloudinaryFailure(undefined, message);
  }

  async getUploadSizeLimit(
    resourceType: 'image' | 'video',
    { cloudName, apiKey, apiSecret }: CloudinaryCredentials,
  ): Promise<number> {
    const message = 'Could not read the Cloudinary upload limits; retry';
    let response: Response;
    try {
      const authorization = Buffer.from(`${apiKey}:${apiSecret}`).toString(
        'base64',
      );
      response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/usage`,
        {
          headers: { Authorization: `Basic ${authorization}` },
          redirect: 'error',
          signal: AbortSignal.timeout(5_000),
        },
      );
    } catch {
      throw cloudinaryFailure(undefined, message);
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw cloudinaryFailure(response.status, message);
    }
    const result = (await response.json().catch(() => null)) as {
      media_limits?: Partial<
        Record<'image_max_size_bytes' | 'video_max_size_bytes', unknown>
      >;
    } | null;
    const limit = result?.media_limits?.[`${resourceType}_max_size_bytes`];
    if (
      typeof limit !== 'number' ||
      !Number.isSafeInteger(limit) ||
      limit < 1
    ) {
      throw cloudinaryFailure(undefined, message);
    }
    return limit;
  }

  /** Delete asset from Cloudinary by public_id. resourceType: 'image' | 'video' | 'raw'. */
  async destroy(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw',
    credentials?: CloudinaryCredentials,
  ): Promise<void> {
    const options = {
      ...this.sdkOptions(credentials),
      resource_type: resourceType,
      invalidate: true,
    };
    const result: unknown = await cloudinary.uploader
      .destroy(publicId, options)
      .catch((error: unknown) => {
        throw cloudinaryFailure(
          cloudinaryStatus(error),
          'Cloudinary deletion failed; retry',
        );
      });
    const status = (result as { result?: string })?.result;
    if (status !== 'ok' && status !== 'not found') {
      throw new ServiceUnavailableException(
        'Cloudinary did not confirm deletion',
      );
    }
  }

  async getUploadResource(
    publicId: string,
    resourceType: 'image' | 'video',
    credentials?: CloudinaryCredentials,
  ) {
    const options = this.sdkOptions(credentials);
    try {
      const result: unknown = await cloudinary.api.resource(publicId, {
        ...options,
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
      const status = cloudinaryStatus(error);
      if (status === 404) return null;
      throw cloudinaryFailure(
        status,
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
    if (!this.appCredentials) return out;
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
