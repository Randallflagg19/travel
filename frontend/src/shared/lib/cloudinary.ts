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

  if (mediaType === "VIDEO") return u;

  if (mediaType === "PHOTO") {
    return injectUploadTransform(u, "f_auto,q_auto,w_1200,c_limit");
  }

  return u;
}

/** Лента/карточки: лёгкий размер для быстрой загрузки. */
export function cloudinaryThumbUrl(
  url: string,
  mediaType: "PHOTO" | "VIDEO" | "AUDIO",
): string {
  let u = safeUrl(url);
  if (!u) return u;
  u = forceHttps(u);

  if (mediaType === "VIDEO") return u;

  if (mediaType === "PHOTO") {
    return injectUploadTransform(u, "f_auto,q_auto,w_600,c_limit");
  }

  return u;
}

/** Раскрытие/модалка: полный размер для просмотра. */
export function cloudinaryFullUrl(
  url: string,
  mediaType: "PHOTO" | "VIDEO" | "AUDIO",
): string {
  let u = safeUrl(url);
  if (!u) return u;
  u = forceHttps(u);

  if (mediaType === "VIDEO") return u;

  if (mediaType === "PHOTO") {
    return injectUploadTransform(u, "f_auto,q_auto,w_2000,c_limit");
  }

  return u;
}

// Use Cloudinary "poster" frame for videos (best-effort).
// width: 600 for thumb (cards), 1200 for full (modal).
export function cloudinaryVideoPosterUrl(
  originalUrl: string,
  publicId: string,
  options?: { width?: number },
): string | null {
  const u = safeUrl(originalUrl);
  if (!u || !publicId) return null;

  const w = options?.width ?? 1200;

  try {
    const idx = u.indexOf("/upload/");
    if (idx === -1) return null;
    const before = u.slice(0, idx + "/upload/".length);
    const after = u.slice(idx + "/upload/".length);
    const base = `${before}so_0,f_jpg,q_auto,w_${w},c_limit/${after}`;
    return base.replace(/\.(mp4|mov|webm|mkv)$/i, ".jpg");
  } catch {
    return null;
  }
}

