function safeUrl(url: string): string {
  return typeof url === "string" ? url : "";
}

function forceHttps(url: string): string {
  return url.startsWith("http://") ? url.replace(/^http:\/\//, "https://") : url;
}

function injectUploadTransform(url: string, transform: string): string {
  // Insert transform right after `/upload/`.
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const before = url.slice(0, idx + marker.length);
  const after = url.slice(idx + marker.length);

  // Avoid double-inserting if already transformed.
  if (after.startsWith(transform + "/")) return url;
  return `${before}${transform}/${after}`;
}

// MVP helper: avoid breaking videos with dynamic transformations.
export function cloudinaryOptimizedUrl(
  url: string,
  mediaType: "PHOTO" | "VIDEO" | "AUDIO",
): string {
  let u = safeUrl(url);
  if (!u) return u;
  u = forceHttps(u);

  // Cloudinary dynamic video transforms can fail (423) on some assets.
  if (mediaType === "VIDEO") return u;

  // For photos (including HEIC), request an auto-format the browser can display.
  // `f_auto` converts HEIC → jpg/webp/avif depending on client.
  if (mediaType === "PHOTO") {
    // Limit output size for faster initial load (Cloudinary will cache derived asset).
    return injectUploadTransform(u, "f_auto,q_auto,w_1200,c_limit");
  }

  return u;
}

// Use Cloudinary "poster" frame for videos (best-effort).
export function cloudinaryVideoPosterUrl(
  originalUrl: string,
  publicId: string,
): string | null {
  const u = safeUrl(originalUrl);
  if (!u || !publicId) return null;

  // Works for typical URLs like: https://res.cloudinary.com/<cloud>/video/upload/<publicId>.<ext>
  // We swap "video/upload" -> "video/upload/so_0" and force jpg.
  try {
    const idx = u.indexOf("/upload/");
    if (idx === -1) return null;
    const before = u.slice(0, idx + "/upload/".length);
    const after = u.slice(idx + "/upload/".length);
    // Make posters small + browser-friendly.
    const base = `${before}so_0,f_jpg,q_auto,w_1200,c_limit/${after}`;
    return base.replace(/\.(mp4|mov|webm|mkv)$/i, ".jpg");
  } catch {
    return null;
  }
}

