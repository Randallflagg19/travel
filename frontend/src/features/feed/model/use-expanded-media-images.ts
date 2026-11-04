import { type RefObject, useCallback, useEffect, useMemo, useState } from "react";
import type { ApiPost } from "@/shared/api/api";
import { cloudinaryPhotoSources, cloudinaryVideoPosterUrl } from "@/shared/lib/cloudinary";
import { type ExpandedImageSource, isExpandedImageReady, readyExpandedPhoto, requestExpandedImage } from "./expanded-image-cache";

type MediaSize = { width: number; height: number; pixelRatio: number };
type MediaVisit = { postId: string; mediaUrl: string | null };
type PhotoSource = { src: string; originalUrl: string; targetWidth: number };
export type ExpandedPhotoImage = {
  src: string | null;
  status: "loading" | "loaded" | "error";
  retry: () => void;
};
type ExpandedMediaImagesOptions = {
  post: ApiPost;
  previewSrc: string | null;
  adjacentMedia: ApiPost[];
  videoRef: RefObject<HTMLVideoElement | null>;
};

function photoSource(post: ApiPost, size: MediaSize): PhotoSource | null {
  if (!post.media_url || !size.width || !size.height) return null;
  const ratio = post.media_width && post.media_height ? post.media_width / post.media_height : 0;
  const width = ratio > 0 ? Math.min(size.width, size.height * ratio) : size.width;
  const targetWidth = Math.ceil(width * size.pixelRatio);
  return { src: cloudinaryPhotoSources(post.media_url, post.media_width, targetWidth).src, originalUrl: post.media_url, targetWidth };
}

export function useExpandedMediaImages({ post, previewSrc, adjacentMedia, videoRef }: ExpandedMediaImagesOptions) {
  const [mediaNode, setMediaNode] = useState<HTMLDivElement | null>(null);
  const mediaRef = useCallback((node: HTMLDivElement | null) => { setMediaNode(node); }, []);
  // Returning to a video creates a new element that must become ready again.
  const visit = useMemo<MediaVisit>(() => ({ postId: post.id, mediaUrl: post.media_url }), [post.id, post.media_url]);
  const [size, setSize] = useState<MediaSize>({ width: 0, height: 0, pixelRatio: 1 });
  const [result, setResult] = useState<{ visit: MediaVisit; src: string; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [readyVideo, setReadyVideo] = useState<MediaVisit | null>(null);

  useEffect(() => {
    if (!mediaNode) return;
    const measure = () => {
      const { width, height } = mediaNode.getBoundingClientRect();
      if (!width || !height) return;
      const pixelRatio = window.devicePixelRatio || 1;
      setSize((current) => current.width === width && current.height === height && current.pixelRatio === pixelRatio
        ? current : { width, height, pixelRatio });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(mediaNode);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mediaNode]);

  const showsPhoto = post.media_type !== "VIDEO" && post.media_type !== "STORY";
  const requested = showsPhoto ? photoSource(post, size) : null;
  // Reuse a larger ready variant when the available space changes between posts.
  const source = requested ? readyExpandedPhoto(post.media_url, requested.targetWidth) ?? requested : null;
  const src = source?.src ?? null;
  const targetWidth = source?.targetWidth ?? 0;
  const ready = Boolean(src && isExpandedImageReady(src));
  const failed = Boolean(src && result?.visit === visit && result.src === src && result.failed);
  const previousSrc = readyExpandedPhoto(post.media_url)?.src ?? null;

  useEffect(() => {
    if (!src) return;
    let active = true;
    const request = requestExpandedImage({ src, originalUrl: post.media_url ?? undefined, targetWidth }, "high");
    void request.promise.then(() => {
      if (active) setResult({ visit, src, failed: false });
    }, () => {
      if (active) setResult({ visit, src, failed: true });
    });
    return () => { active = false; request.release(); };
  }, [src, targetWidth, post.media_url, attempt, visit]);

  useEffect(() => {
    if (!mediaNode || post.media_type !== "VIDEO") return;
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    const onReady = () => {
      if (active && (video.readyState >= 3 || video.error)) setReadyVideo(visit);
    };
    const onWaiting = () => { if (active) setReadyVideo(null); };
    video.addEventListener("canplay", onReady);
    video.addEventListener("error", onReady);
    video.addEventListener("waiting", onWaiting);
    queueMicrotask(onReady);
    return () => {
      active = false;
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onReady);
      video.removeEventListener("waiting", onWaiting);
    };
  }, [visit, post.media_type, videoRef, mediaNode]);

  const adjacentSources = useMemo(() => adjacentMedia.flatMap((item): ExpandedImageSource[] => {
    if (item.media_type === "PHOTO") {
      const source = photoSource(item, size);
      return source ? [source] : [];
    }
    const src = item.media_type === "VIDEO" && item.cloudinary_public_id
      ? cloudinaryVideoPosterUrl(item.media_url ?? "", item.cloudinary_public_id, { width: 600 }) : null;
    return src ? [{ src }] : [];
  }), [adjacentMedia, size]);
  const foregroundSettled = showsPhoto ? ready || failed
    : post.media_type === "VIDEO" && readyVideo === visit;

  useEffect(() => {
    let stopped = false;
    const releases: Array<() => void> = [];
    const pending: ExpandedImageSource[] = [];
    for (const source of adjacentSources) {
      const cached = source.originalUrl ? readyExpandedPhoto(source.originalUrl, source.targetWidth)
        : isExpandedImageReady(source.src) ? source : null;
      if (cached) releases.push(requestExpandedImage(cached, "low").release);
      else pending.push(source);
    }
    async function preload() {
      for (const source of pending) {
        if (stopped) return;
        const request = requestExpandedImage(source, "low");
        releases.push(request.release);
        try { await request.promise; } catch { /* A failed prefetch must not block the next photo. */ }
      }
    }
    if (foregroundSettled) void preload();
    return () => { stopped = true; releases.forEach((release) => release()); };
  }, [adjacentSources, foregroundSettled]);

  const photo: ExpandedPhotoImage = {
    src: ready ? src : previousSrc ?? previewSrc,
    status: ready ? "loaded" : failed ? "error" : "loading",
    retry() { setResult(null); setAttempt((current) => current + 1); },
  };
  return { mediaRef, photo };
}
