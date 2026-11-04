import { BadRequestException } from '@nestjs/common';

export const MEDIA_LIMITS = {
  count: 10,
  photoBytes: 20 * 1024 * 1024,
  videoBytes: 90 * 1024 * 1024,
  videoSeconds: 10 * 60,
} as const;

export type PostMediaRow = {
  id: string;
  post_id: string;
  position: number;
  media_type: 'PHOTO' | 'VIDEO' | 'AUDIO';
  media_url: string;
  cloudinary_public_id: string | null;
  media_width: number | null;
  media_height: number | null;
};

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Expected an object');
  }
  return value as Record<string, unknown>;
}

export function optionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new BadRequestException(`Expected text up to ${max} characters`);
  }
  return value.trim() || null;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new BadRequestException('Invalid media identifier');
  }
  return value.toLowerCase();
}

export function publicationBody(value: unknown) {
  const body = objectBody(value);
  if (
    !Array.isArray(body.uploadIds) ||
    body.uploadIds.length < 1 ||
    body.uploadIds.length > MEDIA_LIMITS.count
  ) {
    throw new BadRequestException('Choose 1–10 photos or videos');
  }
  const uploadIds = body.uploadIds.map(uuid);
  if (new Set(uploadIds).size !== uploadIds.length) {
    throw new BadRequestException('Duplicate attachments');
  }
  const result = {
    uploadIds,
    title: optionalText(body.title, 140),
    text: optionalText(body.text, 12000),
    country: optionalText(body.country, 200),
    city: optionalText(body.city, 200),
  };
  if (result.city && !result.country)
    throw new BadRequestException('Укажите страну для выбранного города');
  return result;
}
