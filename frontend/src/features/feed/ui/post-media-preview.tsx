/* eslint-disable @next/next/no-img-element -- natural dimensions drive masonry */

import { useEffect, useRef, useState } from "react";
import type { ApiPost } from "@/shared/api/api";
import {
  cloudinaryFullUrl,
  cloudinaryPhotoSources,
  cloudinaryThumbUrl,
  cloudinaryVideoPosterUrl,
} from "@/shared/lib/cloudinary";
import { LoaderCircle, Play } from "lucide-react";

type PostMediaPreviewProps = {
  post: ApiPost;
  onOpen: (postId: string) => void;
};

function preloadExpandedMedia(post: ApiPost) {
  if (post.media_type !== "PHOTO" || !post.media_url) return;
  if (typeof window === "undefined") return;
  const img = new window.Image();
  img.src = cloudinaryFullUrl(post.media_url, post.media_type);
}

// Match the feed's sidebar, padding, column gaps, and maximum width.
const PHOTO_SIZES = {
  STANDARD: "(min-width: 2040px) 542px, (min-width: 1024px) calc((100vw - 416px) / 3), (min-width: 640px) calc((100vw - 58px) / 2), calc(100vw - 32px)",
  FEATURED: "(min-width: 2040px) 1099px, (min-width: 1024px) calc((100vw - 392px) * 2 / 3), (min-width: 640px) calc((100vw - 58px) / 2), calc(100vw - 32px)",
};

function PhotoPreview({ post, onOpen }: PostMediaPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const hasDimensions = Boolean(post.media_width && post.media_height);
  const sources = cloudinaryPhotoSources(post.media_url ?? "", post.media_width);
  const preload = () => {
    if (status === "loaded") preloadExpandedMedia(post);
  };

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    // Native lazy loading can fetch several screens ahead. Start only nearby photos.
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
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
      style={{ aspectRatio: hasDimensions ? `${post.media_width} / ${post.media_height}` : "3 / 4" }}
      aria-busy={status === "loading"}
    >
      <button
        type="button"
        className={`block w-full cursor-pointer overflow-hidden ${hasDimensions ? "" : "absolute inset-0 h-full"}`}
        onClick={() => onOpen(post.id)}
        onFocus={preload}
        onPointerEnter={preload}
        onPointerDown={preload}
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
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus("loaded")}
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

export function PostMediaPreview({ post, onOpen }: PostMediaPreviewProps) {
  if (post.media_type === "STORY") return null;
  const mediaUrl = post.media_url ?? "";

  return post.media_type === "VIDEO" ? (
    <button
      type="button"
      className="relative block w-full cursor-pointer overflow-hidden"
      onClick={() => onOpen(post.id)}
      aria-label="Открыть видео"
    >
      {post.cloudinary_public_id ? (
        <img
          className="block h-auto w-full transition duration-500 group-hover:scale-[1.035]"
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
          className="pointer-events-none block h-auto w-full"
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
  ) : <PhotoPreview key={mediaUrl} post={post} onOpen={onOpen} />;
}
