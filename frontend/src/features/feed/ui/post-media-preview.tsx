/* eslint-disable @next/next/no-img-element -- natural dimensions drive masonry */

import { useEffect, useRef, useState } from "react";
import type { ApiPost } from "@/shared/api/api";
import { attachmentFrame, postAttachments } from "../model/post-attachments";
import {
  cloudinaryPhotoSources,
  cloudinaryThumbUrl,
  cloudinaryVideoPosterUrl,
} from "@/shared/lib/cloudinary";
import { ChevronLeft, ChevronRight, LoaderCircle, Play } from "lucide-react";
import { PostMediaThumbnails } from "./post-media-thumbnails";

type PostMediaPreviewProps = {
  post: ApiPost;
  onOpen: (postId: string, attachmentId?: string) => void;
  onPhotoPreviewReady: (originalUrl: string, previewSrc: string) => void;
  fixedAspect?: number;
};

// Match the feed's sidebar, padding, column gaps, and maximum width.
const PHOTO_SIZES = {
  STANDARD: "(min-width: 2040px) 542px, (min-width: 1024px) calc((100vw - 416px) / 3), (min-width: 640px) calc((100vw - 58px) / 2), calc(100vw - 32px)",
  FEATURED: "(min-width: 2040px) 1099px, (min-width: 1024px) calc((100vw - 392px) * 2 / 3), (min-width: 640px) calc((100vw - 58px) / 2), calc(100vw - 32px)",
};

function PhotoPreview({ post, onOpen, onPhotoPreviewReady, fixedAspect }: PostMediaPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const hasDimensions = Boolean(post.media_width && post.media_height) && !fixedAspect;
  const sources = cloudinaryPhotoSources(post.media_url ?? "", post.media_width);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    // Native lazy loading can fetch several screens ahead. Start only nearby photos.
    const observer = new IntersectionObserver((entries) => {
      // Several visibility changes for the same photo can arrive together.
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setShouldLoad(true);
      observer.disconnect();
    }, { rootMargin: "300px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-[#071014]"
      style={{ aspectRatio: fixedAspect ?? (hasDimensions ? `${post.media_width} / ${post.media_height}` : "3 / 4") }}
      aria-busy={status === "loading"}
    >
      <button
        type="button"
        className={`block w-full cursor-pointer overflow-hidden ${hasDimensions ? "" : "absolute inset-0 h-full"}`}
        onClick={() => onOpen(post.id)}
        aria-label="Открыть фото"
      >
        <img
          key={attempt}
          className={`${hasDimensions ? "h-auto" : "h-full object-contain"} block w-full transition duration-500 group-hover:scale-[1.035]`}
          alt={post.title ?? post.text ?? "travel media"}
          width={post.media_width ?? undefined}
          height={post.media_height ?? undefined}
          srcSet={shouldLoad ? sources.srcSet : undefined}
          sizes={sources.srcSet ? PHOTO_SIZES[post.layout] : undefined}
          src={shouldLoad ? sources.src : undefined}
          loading="eager"
          decoding="async"
          onLoad={(event) => {
            setStatus("loaded");
            onPhotoPreviewReady(post.media_url ?? "", event.currentTarget.currentSrc);
          }}
          onError={() => setStatus("error")}
        />
      </button>
      {status !== "loaded" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,#173136,transparent_58%)] px-5 text-center text-amber-50/80 pointer-events-none">
          {status === "loading" ? (
            <>
              <LoaderCircle className="size-6 animate-spin text-[#83c8b6]" aria-hidden="true" />
              <p className="font-serif text-base">Загружаем кадр</p>
            </>
          ) : (
            <>
              <p role="alert" className="font-serif text-base">Не удалось загрузить фото</p>
              <button
                type="button"
                className="pointer-events-auto cursor-pointer rounded-md border border-amber-100/25 px-3 py-2 text-sm hover:bg-white/10"
                onClick={() => {
                  setStatus("loading");
                  setAttempt((current) => current + 1);
                }}
              >
                Повторить
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SingleMediaPreview({ post, onOpen, onPhotoPreviewReady, fixedAspect }: PostMediaPreviewProps) {
  if (post.media_type === "STORY") return null;
  const mediaUrl = post.media_url ?? "";

  return post.media_type === "VIDEO" ? (
    <button
      type="button"
      className="relative block w-full cursor-pointer overflow-hidden"
      onClick={() => onOpen(post.id)}
      aria-label="Открыть видео"
      style={fixedAspect ? { aspectRatio: fixedAspect } : undefined}
    >
      {post.cloudinary_public_id ? (
        <img
          className={`${fixedAspect ? "h-full object-contain" : "h-auto"} block w-full transition duration-500 group-hover:scale-[1.035]`}
          alt={post.title ?? post.text ?? "travel video"}
          width={post.media_width ?? undefined}
          height={post.media_height ?? undefined}
          src={
            cloudinaryVideoPosterUrl(mediaUrl, post.cloudinary_public_id, {
              width: 600,
            }) ?? cloudinaryThumbUrl(mediaUrl, post.media_type)
          }
          loading="lazy"
        />
      ) : (
        <video
          className={`pointer-events-none block w-full ${fixedAspect ? "h-full object-contain" : "h-auto"}`}
          playsInline
          muted
          preload="metadata"
          src={mediaUrl}
        />
      )}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex size-9 lg:size-11 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/30 backdrop-blur transition duration-300 group-hover:scale-110">
          <Play className="ml-0.5 size-4 fill-white lg:size-5" />
        </div>
      </div>
    </button>
  ) : <PhotoPreview key={mediaUrl} post={post} onOpen={onOpen} onPhotoPreviewReady={onPhotoPreviewReady} fixedAspect={fixedAspect} />;
}

export function PostMediaPreview({ post, onOpen, onPhotoPreviewReady }: PostMediaPreviewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const media = postAttachments(post);
  const index = Math.max(0, media.findIndex((item) => item.id === activeId));
  const current = media[index];
  if (!current) return null;
  const carousel = media.length > 1;
  const aspect = post.media_width && post.media_height ? post.media_width / post.media_height : post.media_type === "VIDEO" ? 16 / 9 : 3 / 4;
  function move(direction: -1 | 1) {
    const next = media[index + direction];
    if (next) setActiveId(next.id);
  }
  return <div data-carousel={carousel || undefined}>
    <div className="relative"
    onTouchStart={(event) => {
      touch.current = null;
      if (!carousel || event.touches.length !== 1 || (event.target instanceof Element && event.target.closest("button[aria-label*='кадр']"))) return;
      touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }}
    onTouchCancel={() => { touch.current = null; }}
    onTouchMove={(event) => { if (event.touches.length !== 1) touch.current = null; }}
    onTouchEnd={(event) => {
      const start = touch.current;
      touch.current = null;
      if (!start || event.changedTouches.length !== 1) return;
      const dx = event.changedTouches[0].clientX - start.x;
      const dy = event.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) { event.preventDefault(); move(dx < 0 ? 1 : -1); }
    }}>
    <SingleMediaPreview post={attachmentFrame(post, current)} onOpen={() => onOpen(post.id, current.id)}
      onPhotoPreviewReady={onPhotoPreviewReady} fixedAspect={carousel ? aspect : undefined} />
    {carousel ? <>
      <span className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2.5 py-1 text-xs text-white" aria-live="polite" aria-label="Кадр публикации">{index + 1} / {media.length}</span>
      <button type="button" aria-label="Предыдущий кадр в карточке" disabled={index === 0} onClick={() => move(-1)} className="absolute left-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-25"><ChevronLeft /></button>
      <button type="button" aria-label="Следующий кадр в карточке" disabled={index === media.length - 1} onClick={() => move(1)} className="absolute right-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-25"><ChevronRight /></button>
    </> : null}
    </div>
    <PostMediaThumbnails media={media} activeIndex={index} onSelect={setActiveId} />
  </div>;
}
