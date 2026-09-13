"use client";

import { type RefObject, useEffect } from "react";
import Image from "next/image";
import { BookMarked, ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import type { ApiPost } from "@/shared/api/api";
import {
  cloudinaryFullUrl,
  cloudinaryVideoPosterUrl,
} from "@/shared/lib/cloudinary";

type FeedExpandedModalProps = {
  post: ApiPost;
  onClose: () => void;
  expandedVideoSrc: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  shouldAutoPlayRef: RefObject<boolean>;
  onMove: (direction: -1 | 1) => void;
  canMove: boolean;
};

export function FeedExpandedModal({
  post: expandedPost,
  onClose,
  expandedVideoSrc,
  videoRef,
  shouldAutoPlayRef,
  onMove,
  canMove,
}: FeedExpandedModalProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isArrowKey =
        event.key === "ArrowLeft" || event.key === "ArrowRight";
      const isSpaceKey = event.code === "Space";
      if (!isArrowKey && !isSpaceKey) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        (activeElement.isContentEditable ||
          activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT" ||
          activeElement.closest("[data-video-close]") !== null)
      ) {
        return;
      }

      event.preventDefault();
      if (isArrowKey && canMove) {
        onMove(event.key === "ArrowRight" ? 1 : -1);
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      shouldAutoPlayRef.current = false;

      if (isSpaceKey) {
        if (event.repeat) return;
        if (video.paused) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
        return;
      }

      if (!Number.isFinite(video.duration)) return;
      video.currentTime = Math.min(
        video.duration,
        Math.max(0, video.currentTime + (event.key === "ArrowRight" ? 5 : -5)),
      );
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [canMove, onMove, shouldAutoPlayRef, videoRef]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 p-5 sm:p-7"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр медиа"
      onClick={onClose}
    >
      <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center">
        {expandedPost.media_type === "STORY" ? (
          <article
            className="relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-[#e7ddc9] text-[#33291f] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="z-20 flex shrink-0 items-center justify-between border-b border-[#796752]/20 bg-[#e7ddc9] px-6 py-4">
              <div className="flex items-center gap-4 text-[#594837]">
                <span className="inline-flex items-center gap-1.5 font-story-body text-sm font-medium">
                  <BookMarked className="size-[18px]" strokeWidth={1.8} />
                  История
                </span>
                {expandedPost.city?.trim() || expandedPost.country?.trim() ? (
                  <span className="inline-flex items-center gap-1.5 font-story-body text-sm font-medium">
                    <MapPin className="size-[18px]" strokeWidth={1.8} />
                    {expandedPost.city?.trim() || expandedPost.country?.trim()}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Закрыть историю"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#594837] transition hover:bg-[#d5c8ae]/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#594837]"
                onClick={onClose}
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="story-reader-scroll min-h-0 flex-1 overflow-y-auto">
              <div className="relative px-6 pt-10 pb-28">
                <h2 className="font-story text-4xl leading-[0.98] sm:text-5xl">
                  {expandedPost.title}
                </h2>
                <p className="mt-7 whitespace-pre-line font-story-body text-base leading-8 text-[#493a2d]">
                  {expandedPost.text}
                </p>
              </div>
            </div>
          </article>
        ) : expandedPost.media_type === "VIDEO" ? (
          <div
            className="relative h-full w-full overflow-hidden rounded-lg"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <video
              ref={videoRef}
              className="h-full w-full bg-black object-contain outline-none"
              controls
              playsInline
              preload="auto"
              src={expandedVideoSrc || undefined}
              poster={
                expandedPost.cloudinary_public_id
                  ? (cloudinaryVideoPosterUrl(
                      expandedPost.media_url ?? "",
                      expandedPost.cloudinary_public_id,
                      { width: 1200 },
                    ) ?? undefined)
                  : undefined
              }
              onCanPlay={() => {
                if (shouldAutoPlayRef.current) {
                  shouldAutoPlayRef.current = false;
                  videoRef.current?.play().catch(() => {});
                }
              }}
            />
            <button
              type="button"
              data-video-close
              aria-label="Закрыть видео"
              className="absolute top-3 left-1/2 z-10 flex size-12 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:left-auto md:translate-x-0 md:right-3"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="size-6" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="relative h-full w-full cursor-zoom-out overflow-hidden rounded-lg"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Image
              alt={expandedPost.title ?? expandedPost.text ?? "travel media"}
              src={cloudinaryFullUrl(
                expandedPost.media_url ?? "",
                expandedPost.media_type,
              )}
              fill
              sizes="100vw"
              className="object-contain"
              unoptimized
              priority
            />
          </button>
        )}
        {expandedPost.media_type !== "STORY" &&
        (expandedPost.title || expandedPost.text) ? (
          <aside
            className="absolute inset-x-5 bottom-5 z-20 mx-auto max-h-44 max-w-2xl overflow-y-auto rounded-xl border border-white/15 bg-black/65 px-4 py-3 text-left text-amber-50 shadow-xl backdrop-blur"
            onClick={(event) => event.stopPropagation()}
          >
            {expandedPost.title ? (
              <h2 className="font-serif text-xl leading-tight">
                {expandedPost.title}
              </h2>
            ) : null}
            {expandedPost.text ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-amber-50/80">
                {expandedPost.text}
              </p>
            ) : null}
          </aside>
        ) : null}
        {canMove && expandedPost.media_type !== "STORY" ? (
          <>
            <button
              type="button"
              aria-label="Предыдущее фото или видео"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-3 text-white backdrop-blur hover:bg-black/70"
              onClick={(e) => {
                e.stopPropagation();
                onMove(-1);
              }}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              aria-label="Следующее фото или видео"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-3 text-white backdrop-blur hover:bg-black/70"
              onClick={(e) => {
                e.stopPropagation();
                onMove(1);
              }}
            >
              <ChevronRight />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
