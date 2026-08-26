"use client";

import { Heart, MapPin, MessageSquare, Trash2 } from "lucide-react";
import type { ApiPost } from "@/shared/api/api";
import { Card, CardContent } from "@/shared/ui/card";
import { PostCommentsBlock } from "./post-comments-block";
import { displayPlaceTitle } from "@/features/places/model/place-labels";
import { PostMediaPreview } from "./post-media-preview";
import { usePostLikeToggle } from "../model/use-post-like-toggle";

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

export function FeedPostCard({
  post,
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
  const liked = Boolean(post.liked_by_me);

  const { likePending, toggleLike } = usePostLikeToggle({
    canLike,
    accessToken,
    onLikeToggled,
    onLikeSuccess,
    liked,
    post,
  });

  async function handleLikeClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleLike();
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
            onDelete(post.id);
          }}
          aria-label="Удалить пост"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
      <CardContent className="p-0">
        <PostMediaPreview post={post} onOpen={onOpen} />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/84 via-black/42 to-transparent" />

        <div className="absolute left-4 top-4 rounded-xl bg-black/55 px-3 py-1 text-[11px] font-semibold tracking-wide text-white ring-1 ring-white/15 backdrop-blur">
          {post.media_type === "VIDEO" ? "VIDEO" : "PHOTO"}
        </div>

        <div className="absolute inset-x-0 bottom-0 space-y-3 p-4 text-white">
          <div>
            {post.text ? (
              <h3 className="line-clamp-2 text-lg font-medium leading-tight">
                {post.text}
              </h3>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/58">
              {showPlaceInCard && (post.country || post.city) ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {displayPlaceTitle(
                    post.country ?? "Unknown",
                    post.city ?? "",
                  )}
                </span>
              ) : null}
              {post.lat != null && post.lng != null ? (
                <span>
                  {post.lat.toFixed(4)}, {post.lng.toFixed(4)}
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
              <span>{post.like_count}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenComments(post.id);
              }}
              className="relative z-10 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 transition hover:bg-white/16"
              aria-label="Комментарии"
            >
              <MessageSquare className="size-4" />
              <span>{post.comment_count}</span>
            </button>
          </div>
        </div>

        {isCommentsOpen ? (
          <div className="relative z-20 border-t border-white/10 bg-[#081117] p-4">
            <PostCommentsBlock
              postId={post.id}
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
