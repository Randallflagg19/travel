"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, Play, Trash2 } from "lucide-react";
import type { ApiPost } from "@/shared/api/api";
import { likePost, unlikePost } from "@/shared/api/api";
import {
  cloudinaryThumbUrl,
  cloudinaryVideoPosterUrl,
} from "@/shared/lib/cloudinary";
import { Card, CardContent } from "@/shared/ui/card";

type FeedPostCardProps = {
  post: ApiPost;
  deleteMode: boolean;
  canDelete: boolean;
  onDelete: (postId: string) => void;
  onOpen: (postId: string) => void;
  showPlaceInCard: boolean;
  canLike: boolean;
  accessToken: string | null;
  onLikeToggled: (postId: string, liked: boolean, deltaCount: number) => void;
  onLikeSuccess?: () => void;
};

export function FeedPostCard({
  post: p,
  deleteMode,
  canDelete,
  onDelete,
  onOpen,
  showPlaceInCard,
  canLike,
  accessToken,
  onLikeToggled,
  onLikeSuccess,
}: FeedPostCardProps) {
  const [likePending, setLikePending] = useState(false);
  const liked = Boolean(p.liked_by_me);

  async function handleLikeClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canLike || !accessToken || likePending) return;
    const nextLiked = !liked;
    const delta = nextLiked ? 1 : -1;
    onLikeToggled(p.id, nextLiked, delta);
    setLikePending(true);
    try {
      if (nextLiked) await likePost(accessToken, p.id);
      else await unlikePost(accessToken, p.id);
      onLikeSuccess?.();
    } catch {
      onLikeToggled(p.id, liked, -delta);
    } finally {
      setLikePending(false);
    }
  }

  return (
    <Card className="relative overflow-hidden">
      {deleteMode && canDelete ? (
        <button
          type="button"
          className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-red-600/90 text-white shadow hover:bg-red-600"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(p.id);
          }}
          aria-label="Удалить пост"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
      <CardContent className="space-y-3 pt-6">
        {p.media_type === "VIDEO" ? (
          <button
            type="button"
            className="relative block w-full cursor-zoom-in"
            onClick={() => onOpen(p.id)}
            aria-label="Открыть видео"
          >
            {p.cloudinary_public_id ? (
              <Image
                className="h-auto w-full rounded-lg border"
                alt={p.text ?? "travel video"}
                src={
                  cloudinaryVideoPosterUrl(p.media_url, p.cloudinary_public_id, {
                    width: 600,
                  }) ?? cloudinaryThumbUrl(p.media_url, p.media_type)
                }
                width={720}
                height={540}
                sizes="(max-width: 768px) 100vw, 720px"
                unoptimized
              />
            ) : (
              <video
                className="pointer-events-none w-full rounded-lg border"
                playsInline
                muted
                preload="metadata"
                src={p.media_url}
              />
            )}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30">
                <Play className="ml-0.5 size-6 fill-white" />
              </div>
            </div>
            <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white ring-1 ring-white/20">
              VIDEO
            </div>
          </button>
        ) : (
          <button
            type="button"
            className="block w-full cursor-zoom-in"
            onClick={() => onOpen(p.id)}
          >
            <Image
              className="h-auto w-full rounded-lg border"
              alt={p.text ?? "travel media"}
              src={cloudinaryThumbUrl(p.media_url, p.media_type)}
              width={720}
              height={540}
              sizes="(max-width: 768px) 100vw, 720px"
              unoptimized
            />
          </button>
        )}

        {p.text ? <p className="text-sm leading-relaxed">{p.text}</p> : null}

        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
          {canLike ? (
            <button
              type="button"
              onClick={handleLikeClick}
              disabled={likePending}
              className="flex items-center gap-1 rounded p-0.5 transition hover:opacity-80 disabled:opacity-50"
              aria-label={liked ? "Снять лайк" : "Лайкнуть"}
            >
              <Heart
                className={`size-4 ${liked ? "fill-red-500 text-red-500" : ""}`}
              />
              <span>{p.like_count}</span>
            </button>
          ) : (
            <span className="flex items-center gap-1">
              <Heart className="size-4" />
              {p.like_count}
            </span>
          )}
          <span>💬 {p.comment_count}</span>
          {p.lat != null && p.lng != null ? (
            <span>
              📍 {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
            </span>
          ) : null}
          {showPlaceInCard ? (
            <span>
              {(p.country ?? "Unknown") + (p.city ? ` / ${p.city}` : "")}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
