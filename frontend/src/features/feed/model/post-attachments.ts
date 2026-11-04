import type { ApiPost, ApiPostMedia } from "@/shared/api/api";

export function postAttachments(post: ApiPost): ApiPostMedia[] {
  if (post.media_type === "STORY") return [];
  if (post.attachments?.length) return post.attachments;
  return post.media_url ? [{
    id: post.id, position: 0, media_type: post.media_type, media_url: post.media_url,
    cloudinary_public_id: post.cloudinary_public_id, media_width: post.media_width, media_height: post.media_height,
  }] : [];
}

// Reuse the photo/video components while retaining the publication's identity and text.
export function attachmentFrame(post: ApiPost, media: ApiPostMedia): ApiPost {
  return { ...post, media_type: media.media_type, media_url: media.media_url,
    cloudinary_public_id: media.cloudinary_public_id, media_width: media.media_width, media_height: media.media_height };
}
