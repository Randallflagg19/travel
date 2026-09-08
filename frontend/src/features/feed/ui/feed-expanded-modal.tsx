"use client";

import { type RefObject, useState } from "react";
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
  const [isPlaying, setIsPlaying] = useState(false);

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
              className="h-full w-full bg-black object-contain"
              controls
              playsInline
              preload="auto"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
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
            {/* Keep the native control bar outside the tap-to-toggle area. */}
            <button
              type="button"
              aria-label={
                isPlaying ? "Приостановить видео" : "Продолжить видео"
              }
              className="absolute inset-x-0 top-0 bottom-20 cursor-pointer outline-none"
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
                e.preventDefault();
                e.stopPropagation();
                const video = videoRef.current;
                if (!video || !Number.isFinite(video.duration)) return;
                shouldAutoPlayRef.current = false;
                video.currentTime = Math.min(
                  video.duration,
                  Math.max(0, video.currentTime + (e.key === "ArrowRight" ? 5 : -5)),
                );
              }}
              onClick={(e) => {
                e.stopPropagation();
                const video = videoRef.current;
                if (!video) return;
                shouldAutoPlayRef.current = false;
                if (video.paused) {
                  void video.play().catch(() => {});
                } else {
                  video.pause();
                }
              }}
            />
            <button
              type="button"
              aria-label="Закрыть видео"
              className="absolute z-10 flex size-12 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{
                top: "max(0.75rem, env(safe-area-inset-top, 0px))",
                right: "max(0.75rem, env(safe-area-inset-right, 0px))",
              }}
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
