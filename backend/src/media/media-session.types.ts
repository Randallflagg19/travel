export type MediaSession = {
  id: string;
  user_id: string;
  environment: string;
  author_cloud_name: string | null;
  state: string;
  post_id: string | null;
  publication_hash: string | null;
  expired: boolean;
};
export type MediaUpload = {
  id: string;
  session_id: string;
  media_type: 'PHOTO' | 'VIDEO';
  cloud_name: string;
  author_user_id: string | null;
  size_limit_bytes: number | null;
  public_id: string;
  resource_type: 'image' | 'video';
  declared_bytes: number;
  ready: boolean;
  media_url: string | null;
  media_width: number | null;
  media_height: number | null;
};
export type MediaDeletion = {
  id: string;
  cloud_name: string;
  author_user_id: string | null;
  public_id: string;
  resource_type: 'image' | 'video' | 'raw';
  attempts: number;
};
