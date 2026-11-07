import type { PostMediaRow } from '../media/media-contract';

export type MediaType = 'PHOTO' | 'VIDEO' | 'AUDIO' | 'STORY';
export type PostLayout = 'STANDARD' | 'FEATURED';

export type PostRow = {
  attachments?: PostMediaRow[];
  id: string;
  user_id: string;
  media_type: MediaType;
  media_url: string | null;
  cloudinary_public_id: string | null;
  folder: string | null;
  text: string | null;
  title: string | null;
  layout: PostLayout;
  media_width: number | null;
  media_height: number | null;
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  pinned_at: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me?: boolean;
};

export function normalizePost(row: PostRow): PostRow {
  if (row.media_type === 'STORY' && !row.media_url) {
    return { ...row, media_url: null };
  }
  return row;
}
