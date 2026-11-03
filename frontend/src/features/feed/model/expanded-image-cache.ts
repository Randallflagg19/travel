type ImagePriority = "high" | "low";
export type ExpandedImageSource = { src: string; originalUrl?: string; targetWidth?: number };
type CachedImage = {
  source: ExpandedImageSource;
  image: HTMLImageElement;
  ready: boolean;
  promise: Promise<void>;
  consumers: Map<symbol, ImagePriority>;
};

const MAX_CACHED_IMAGES = 8;
const images = new Map<string, CachedImage>();

function trimCache() {
  for (const [src, entry] of images) {
    if (images.size <= MAX_CACHED_IMAGES) break;
    if (entry.ready && entry.consumers.size === 0) images.delete(src);
  }
}

export function isExpandedImageReady(src: string) {
  return images.get(src)?.ready === true;
}

export function readyExpandedPhoto(originalUrl: string | null, minimumWidth = 0) {
  let ready: ExpandedImageSource | undefined;
  if (!originalUrl) return ready;
  for (const entry of images.values()) {
    if (entry.ready && entry.source.originalUrl === originalUrl &&
        (entry.source.targetWidth ?? 0) >= minimumWidth &&
        (!ready || (entry.source.targetWidth ?? 0) > (ready.targetWidth ?? 0))) ready = entry.source;
  }
  return ready;
}

export function requestExpandedImage(source: ExpandedImageSource, priority: ImagePriority) {
  const { src } = source;
  let entry = images.get(src);
  if (!entry) {
    const image = new window.Image();
    image.decoding = "async";
    image.fetchPriority = priority;
    image.src = src;
    const created: CachedImage = {
      source, image, ready: false, promise: Promise.resolve(), consumers: new Map(),
    };
    created.promise = image.decode().then(() => {
      created.ready = true;
      trimCache();
    }, (error: unknown) => {
      if (images.get(src) === created) images.delete(src);
      throw error;
    });
    images.set(src, created);
    entry = created;
  }
  if ((source.targetWidth ?? 0) > (entry.source.targetWidth ?? 0)) entry.source = source;

  // Touch the entry so unused decoded images are evicted in least-recently-used order.
  images.delete(src);
  images.set(src, entry);
  const consumer = Symbol();
  entry.consumers.set(consumer, priority);
  entry.image.fetchPriority = [...entry.consumers.values()].includes("high") ? "high" : "low";

  return {
    promise: entry.promise,
    release() {
      if (!entry.consumers.delete(consumer)) return;
      entry.image.fetchPriority = [...entry.consumers.values()].includes("high") ? "high" : "low";
      // Navigation may promote this same pending image from background to foreground.
      queueMicrotask(() => {
        if (!entry.ready && entry.consumers.size === 0 && images.get(src) === entry) {
          images.delete(src);
          entry.image.removeAttribute("src");
        }
        trimCache();
      });
    },
  };
}
