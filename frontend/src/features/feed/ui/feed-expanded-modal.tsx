"use client";

import { type MutableRefObject, type RefObject } from "react";
import Image from "next/image";
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
  shouldAutoPlayRef: MutableRefObject<boolean>;
  lastVideoTapRef: MutableRefObject<number>;
};

export function FeedExpandedModal({
  post: expandedPost,
  onClose,
  expandedVideoSrc,
  videoRef,
  shouldAutoPlayRef,
  lastVideoTapRef,
}: FeedExpandedModalProps) {
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
              const now = Date.now();
              if (now - lastVideoTapRef.current < 300) {
                onClose();
                return;
              }
              lastVideoTapRef.current = now;
              e.stopPropagation();
            }}
          >
            <video
              ref={videoRef}
              className="h-full w-full bg-black object-contain"
              controls
              playsInline
              preload="auto"
              src={expandedVideoSrc || undefined}
              poster={
                expandedPost.cloudinary_public_id
                  ? cloudinaryVideoPosterUrl(
                      expandedPost.media_url,
                      expandedPost.cloudinary_public_id,
                      { width: 1200 },
                    ) ?? undefined
                  : undefined
              }
              onCanPlay={() => {
                if (shouldAutoPlayRef.current) {
                  shouldAutoPlayRef.current = false;
                  videoRef.current?.play().catch(() => {});
                }
              }}
            />
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
              src={cloudinaryFullUrl(expandedPost.media_url, expandedPost.media_type)}
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
