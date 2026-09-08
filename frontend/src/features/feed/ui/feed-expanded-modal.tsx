"use client";

import { type RefObject, useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";
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
};

export function FeedExpandedModal({
  post: expandedPost,
  onClose,
  expandedVideoSrc,
  videoRef,
  shouldAutoPlayRef,
}: FeedExpandedModalProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isArrowKey =
        event.key === "ArrowLeft" || event.key === "ArrowRight";
      const isSpaceKey = event.code === "Space";
      if (!isArrowKey && !isSpaceKey) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

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

      const video = videoRef.current;
      if (!video) return;

      event.preventDefault();
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
  }, [shouldAutoPlayRef, videoRef]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр медиа"
      onClick={onClose}
    >
      <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center">
        {expandedPost.media_type === "VIDEO" ? (
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
                      expandedPost.media_url,
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
              alt={expandedPost.text ?? "travel media"}
              src={cloudinaryFullUrl(
                expandedPost.media_url,
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
      </div>
    </div>
  );
}
