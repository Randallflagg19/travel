export type CloudinaryResource = {
  asset_id: string;
  public_id: string;
  resource_type: string;
  format?: string;
  secure_url?: string;
  created_at?: string;
  folder?: string;
  asset_folder?: string;
  width?: number;
  height?: number;
};

export type ResourceType = 'image' | 'video' | 'raw';

export type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function toResourceType(value: string): ResourceType {
  if (value === 'image' || value === 'video' || value === 'raw') return value;
  // Cloudinary sometimes uses "image"/"video"/"raw"; fall back to image.
  return 'image';
}
