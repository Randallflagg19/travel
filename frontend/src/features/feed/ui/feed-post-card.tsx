"use client";

import { memo, useEffect, useState } from "react";
import {
  BookMarked,
  Heart,
  LoaderCircle,
  MapPin,
  MessageSquare,
  Trash2,
} from "lucide-react";
import type { ApiPost } from "@/shared/api/api";
import {
  cloudinaryThumbUrl,
  cloudinaryVideoPosterUrl,
} from "@/shared/lib/cloudinary";
import { Card, CardContent } from "@/shared/ui/card";
import { PostCommentsBlock } from "./post-comments-block";
import { displayPlaceTitle } from "@/features/places/model/place-labels";
import { PostMediaPreview } from "./post-media-preview";
import { usePostLikeToggle } from "../model/use-post-like-toggle";
import { PostActionsMenu } from "./post-actions-menu";
import { OPEN_COMMENTS_HEIGHT } from "./feed-masonry-item";

type FeedPostCardProps = {
  post: ApiPost;
  deleteMode: boolean;
  canDelete: boolean;
  canEdit: boolean;
  onDelete: (postId: string) => void;
  onEdit: (post: ApiPost) => void;
  onToggleFeatured: (post: ApiPost) => void;
  isActionsOpen: boolean;
  onActionsOpenChange: (open: boolean) => void;
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

function previewUrl(post: ApiPost): string | null {
  if (!post.media_url || post.media_type === "STORY") return null;
  if (post.media_type === "VIDEO") {
    return post.cloudinary_public_id
      ? cloudinaryVideoPosterUrl(post.media_url, post.cloudinary_public_id, {
          width: 600,
        })
      : null;
  }
  return cloudinaryThumbUrl(post.media_url, post.media_type);
}

function useMediaPreviewReady(post: ApiPost) {
  const url = previewUrl(post);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    const image = new Image();
    const finish = () => setLoadedUrl(url);
    image.addEventListener("load", finish);
    image.addEventListener("error", finish);
    image.src = url;
    if (image.complete) queueMicrotask(finish);

    return () => {
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
    };
  }, [url]);

  return !url || loadedUrl === url;
}

export const FeedPostCard = memo(function FeedPostCard({
  post,
  deleteMode,
  canDelete,
  canEdit,
  onDelete,
  onEdit,
  onToggleFeatured,
  isActionsOpen,
  onActionsOpenChange,
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
  const mediaReady = useMediaPreviewReady(post);
  const liked = Boolean(post.liked_by_me);
  const storyPlace = post.city?.trim() || post.country?.trim() || null;

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

  const actions = (
    <div
      className={`pointer-events-auto flex w-full items-center justify-between gap-2 text-xs ${
        post.media_type === "STORY" ? "text-[#4a3b2d]" : "text-amber-100/75"
      }`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleLikeClick}
          disabled={likePending}
          className="relative z-10 flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-md px-1 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/85 disabled:opacity-50"
          aria-label={liked ? "Снять лайк" : "Лайкнуть"}
        >
          <Heart
            className={`size-[18px] ${liked ? "fill-red-400 text-red-400" : ""}`}
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
          className="relative z-10 flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-md px-1 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/85"
          aria-label="Комментарии"
        >
          <MessageSquare className="size-[18px]" />
          <span>{post.comment_count}</span>
        </button>
      </div>
      {!deleteMode && canEdit ? (
        <PostActionsMenu
          open={isActionsOpen}
          onOpenChange={onActionsOpenChange}
          onEdit={() => onEdit(post)}
          onDelete={() => onDelete(post.id)}
          isFeatured={post.layout === "FEATURED"}
          onToggleFeatured={
            post.media_type === "STORY"
              ? undefined
              : () => onToggleFeatured(post)
          }
          variant={post.media_type === "STORY" ? "story" : "default"}
        />
      ) : null}
    </div>
  );

  if (post.media_type === "STORY")
    return (
      <Card className="travel-card-glow relative overflow-hidden rounded-xl border-amber-200/25 bg-[#e7ddc9] p-0 text-[#33291f] transition duration-300 hover:border-amber-200/50">
        {deleteMode && canDelete ? (
          <button
            type="button"
            className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-red-600/90 text-white shadow hover:bg-red-600"
            onClick={() => onDelete(post.id)}
            aria-label="Удалить историю"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
        <CardContent
          className="relative flex aspect-[3/4] min-h-80 flex-col p-5"
          style={{
            backgroundImage: "url('/images/stories/story-bg.webp')",
            backgroundPosition: "center bottom",
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 100%",
          }}
        >
          <div className="relative flex items-center justify-between text-[11px] text-[#594837]">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#d5c8ae]/70 px-2.5 py-1.5 font-story-body text-sm font-medium leading-none">
              <BookMarked className="size-[18px]" strokeWidth={1.8} />
              История
            </span>
            {storyPlace ? (
              <span className="inline-flex items-center gap-1.5 font-story-body text-sm font-medium leading-none">
                <MapPin className="size-[18px]" strokeWidth={1.8} />
                {storyPlace}
              </span>
            ) : null}
          </div>
          <h3 className="relative mt-5 font-story text-3xl leading-[0.96]">
            {post.title}
          </h3>
          <p className="relative mt-3 line-clamp-7 whitespace-pre-line font-story-body text-sm leading-relaxed text-[#4b3d30]">
            {post.text}
          </p>
          <button
            type="button"
            onClick={() => onOpen(post.id)}
            className="group relative mt-auto flex min-h-24 w-full cursor-pointer items-center justify-center rounded-md px-5 pt-5 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315b55]"
          >
            <span className="inline-flex rounded-full border border-[#315b55]/20 bg-[#d5c8ae]/55 px-5 py-2 font-story-body text-sm font-medium text-[#315b55] transition-colors group-hover:bg-[#d5c8ae]/80">
              Открыть историю
            </span>
          </button>
          <div className="relative flex items-center justify-between border-t border-[#796752]/25 pt-1 text-[#514334]">
            {actions}
          </div>
        </CardContent>
        {isCommentsOpen ? (
          <div
            className="relative z-20 border-t border-[#796752]/25 bg-[#efe4ce] p-4"
            style={{ height: OPEN_COMMENTS_HEIGHT }}
          >
            <PostCommentsBlock
              postId={post.id}
              canComment={canComment}
              currentUserId={currentUserId}
              accessToken={accessToken}
              onCommentAdded={onCommentAdded}
              onClose={() => onOpenComments(post.id)}
              variant="story"
            />
          </div>
        ) : null}
      </Card>
    );

  if (!mediaReady)
    return (
      <Card className="travel-card-glow overflow-hidden rounded-xl border-amber-200/15 bg-[#071014] p-0">
        <CardContent
          className="flex min-h-56 flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,#173136,transparent_58%)] px-5 text-center text-amber-50/80"
          style={{
            aspectRatio:
              post.media_width && post.media_height
                ? `${post.media_width} / ${post.media_height}`
                : undefined,
          }}
        >
          <span className="flex size-11 items-center justify-center rounded-full border border-amber-100/15 bg-white/5">
            <LoaderCircle className="size-5 animate-spin text-[#83c8b6]" />
          </span>
          <div>
            <p className="font-serif text-base text-amber-50">Загружаем кадр</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-50/55">
              Подготавливаем его для ленты
            </p>
          </div>
        </CardContent>
      </Card>
    );

  return (
    <Card className="travel-card-glow group relative overflow-hidden rounded-xl border-amber-200/20 bg-[#071014] p-0 transition duration-300 hover:border-amber-200/25">
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
        <div className="relative">
          <PostMediaPreview post={post} onOpen={onOpen} />

          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/90 via-black/45 to-transparent lg:hidden" />

          {post.media_type === "VIDEO" ? (
            <div className="pointer-events-none absolute left-2.5 top-2.5 rounded-md bg-[#071014]/75 px-2 py-1 text-[10px] font-semibold tracking-[0.03em] text-white ring-1 ring-white/15 backdrop-blur">
              Видео
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 px-3 pt-3 pb-1 text-amber-50 lg:relative lg:border-t lg:border-amber-200/10 lg:px-4 lg:pt-2">
            <div className="feed-media-overlay-text pointer-events-none">
              {post.title ? (
                <h3 className="line-clamp-1 font-serif text-base font-normal leading-tight lg:line-clamp-2 lg:text-lg">
                  {post.title}
                </h3>
              ) : null}
              {post.text ? (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-amber-50/75 lg:text-sm">
                  {post.text}
                </p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-amber-100/65 lg:text-xs">
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

            {actions}
          </div>
        </div>

        {isCommentsOpen ? (
          <div
            className="relative z-20 border-t border-white/10 bg-[#081117] p-4"
            style={{ height: OPEN_COMMENTS_HEIGHT }}
          >
            <PostCommentsBlock
              postId={post.id}
              canComment={canComment}
              currentUserId={currentUserId}
              accessToken={accessToken}
              onCommentAdded={onCommentAdded}
              onClose={() => onOpenComments(post.id)}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});
