import { BadRequestException } from '@nestjs/common';
import {
  MEDIA_LIMITS,
  objectBody,
  optionalText,
  uuid,
} from '../media/media-contract';

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
