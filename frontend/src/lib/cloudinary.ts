export function cloudinaryOptimizedUrl(
  input: string,
  mediaType: "PHOTO" | "VIDEO" | "AUDIO",
) {
  // If it's not a Cloudinary delivery URL - return as-is.
  if (!input.includes("res.cloudinary.com/")) return input;

  // Important: do NOT apply on-the-fly transformations to videos in MVP.
  // Cloudinary may respond with 423 for large MOV videos when requesting derived/transcoded versions.
  // We'll keep the original URL for VIDEO to avoid transformation locks.
  if (mediaType === "VIDEO") return input;

  // Inject transformations right after `/upload/` to force browser-friendly formats (HEIC -> JPEG/WebP/AVIF).
  // Example:
  // https://res.cloudinary.com/<cloud>/<type>/upload/v123/public_id.heic
  // -> https://res.cloudinary.com/<cloud>/<type>/upload/f_auto,q_auto/v123/public_id.heic
  const parts = input.split("/upload/");
  if (parts.length !== 2) return input;

  const transform =
    mediaType === "PHOTO" ? "f_auto,q_auto,w_1600" : "f_auto,q_auto";

  return `${parts[0]}/upload/${transform}/${parts[1]}`;
}

function getCloudNameFromUrl(input: string): string | null {
  // https://res.cloudinary.com/<cloud>/...
  const match = input.match(/res\.cloudinary\.com\/([^/]+)\//);
  return match?.[1] ?? null;
}

export function cloudinaryVideoPosterUrl(
  mediaUrl: string,
  publicId: string,
): string | null {
  const cloud = getCloudNameFromUrl(mediaUrl);
  if (!cloud) return null;
  // Extract a frame from the video as a JPG poster (cheap + fast).
  // `so_0` = start offset; `f_jpg` = JPG output.
  return `https://res.cloudinary.com/${cloud}/video/upload/so_0,f_jpg,q_auto,w_1200/${publicId}.jpg`;
}

export function cloudinaryVideoMp4Url(
  mediaUrl: string,
  publicId: string,
): string | null {
  const cloud = getCloudNameFromUrl(mediaUrl);
  if (!cloud) return null;
  // MP4 is the most compatible for mobile browsers.
  return `https://res.cloudinary.com/${cloud}/video/upload/f_mp4,q_auto/${publicId}.mp4`;
}
