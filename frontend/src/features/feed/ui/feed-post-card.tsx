"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, MapPin, MessageSquare, Play, Trash2 } from "lucide-react";
import type { ApiPost } from "@/shared/api/api";
import { likePost, unlikePost } from "@/shared/api/api";
import {
  cloudinaryFullUrl,
  cloudinaryThumbUrl,
  cloudinaryVideoPosterUrl,
} from "@/shared/lib/cloudinary";
import { Card, CardContent } from "@/shared/ui/card";
import { PostCommentsBlock } from "./post-comments-block";
import { displayPlaceTitle } from "@/features/places/model/place-labels";

type FeedPostCardProps = {
  post: ApiPost;
  deleteMode: boolean;
  canDelete: boolean;
  onDelete: (postId: string) => void;
  onOpen: (postId: string) => void;
  showPlaceInCard: boolean;
  canLike: boolean;
  canComment: boolean;
  isCommentsOpen: boolean;
  currentUserId: string | null;
  accessToken: string | null;
  onLikeToggled: (postId: string, liked: boolean, deltaCount: number) => void;
  onLikeSuccess?: () => void;
  onOpenComments: (postId: string) => void;
  onCommentAdded?: () => void;
};

function formatPostDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function preloadExpandedMedia(post: ApiPost) {
  if (post.media_type !== "PHOTO") return;
  if (typeof window === "undefined") return;
  const img = new window.Image();
  img.src = cloudinaryFullUrl(post.media_url, post.media_type);
}

export function FeedPostCard({
  post: p,
  deleteMode,
  canDelete,
  onDelete,
  onOpen,
  showPlaceInCard,
  canLike,
  canComment,
  isCommentsOpen,
  currentUserId,
  accessToken,
  onLikeToggled,
  onLikeSuccess,
  onOpenComments,
  onCommentAdded,
}: FeedPostCardProps) {
  const router = useRouter();
  const [likePending, setLikePending] = useState(false);
  const liked = Boolean(p.liked_by_me);

  async function handleLikeClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (likePending) return;
    if (!canLike || !accessToken) {
      router.push("/login");
      return;
    }
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
    <Card className="travel-card-glow group relative overflow-hidden rounded-[1.75rem] border-white/10 bg-white/[0.055] p-0 transition duration-300 hover:-translate-y-1 hover:border-amber-200/25">
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
      <CardContent className="p-0">
        {p.media_type === "VIDEO" ? (
          <button
            type="button"
            className="relative block w-full cursor-zoom-in overflow-hidden"
            onClick={() => onOpen(p.id)}
            aria-label="Открыть видео"
          >
            {p.cloudinary_public_id ? (
              <Image
                className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                alt={p.text ?? "travel video"}
                src={
                  cloudinaryVideoPosterUrl(
                    p.media_url,
                    p.cloudinary_public_id,
                    {
                      width: 600,
                    },
                  ) ?? cloudinaryThumbUrl(p.media_url, p.media_type)
                }
                width={720}
                height={540}
                sizes="(max-width: 768px) 100vw, 720px"
                unoptimized
              />
            ) : (
              <video
                className="pointer-events-none aspect-[4/3] w-full object-cover"
                playsInline
                muted
                preload="metadata"
                src={p.media_url}
              />
            )}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30 backdrop-blur transition duration-300 group-hover:scale-110">
                <Play className="ml-0.5 size-6 fill-white" />
              </div>
            </div>
          </button>
        ) : (
          <button
            type="button"
            className="block w-full cursor-zoom-in overflow-hidden"
            onClick={() => onOpen(p.id)}
            onFocus={() => preloadExpandedMedia(p)}
            onPointerEnter={() => preloadExpandedMedia(p)}
            onPointerDown={() => preloadExpandedMedia(p)}
          >
            <Image
              className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.035]"
              alt={p.text ?? "travel media"}
              src={cloudinaryThumbUrl(p.media_url, p.media_type)}
              width={720}
              height={540}
              sizes="(max-width: 768px) 100vw, 720px"
              unoptimized
            />
          </button>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/84 via-black/42 to-transparent" />

        <div className="absolute left-4 top-4 rounded-xl bg-black/55 px-3 py-1 text-[11px] font-semibold tracking-wide text-white ring-1 ring-white/15 backdrop-blur">
          {p.media_type === "VIDEO" ? "VIDEO" : "PHOTO"}
        </div>

        <div className="absolute inset-x-0 bottom-0 space-y-3 p-4 text-white">
          <div>
            {p.text ? (
              <h3 className="line-clamp-2 text-lg font-medium leading-tight">
                {p.text}
              </h3>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/58">
              {showPlaceInCard && (p.country || p.city) ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {displayPlaceTitle(p.country ?? "Unknown", p.city ?? "")}
                </span>
              ) : null}
              {p.lat != null && p.lng != null ? (
                <span>
                  {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/72">
            <button
              type="button"
              onClick={handleLikeClick}
              disabled={likePending}
              className="relative z-10 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 transition hover:bg-white/16 disabled:opacity-50"
              aria-label={liked ? "Снять лайк" : "Лайкнуть"}
            >
              <Heart
                className={`size-4 ${liked ? "fill-red-400 text-red-400" : ""}`}
              />
              <span>{p.like_count}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenComments(p.id);
              }}
              className="relative z-10 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 transition hover:bg-white/16"
              aria-label="Комментарии"
            >
              <MessageSquare className="size-4" />
              <span>{p.comment_count}</span>
            </button>
          </div>
        </div>

        {isCommentsOpen ? (
          <div className="relative z-20 border-t border-white/10 bg-[#081117] p-4">
            <PostCommentsBlock
              postId={p.id}
              canComment={canComment}
              currentUserId={currentUserId}
              accessToken={accessToken}
              onCommentAdded={onCommentAdded}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
