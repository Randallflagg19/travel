"use client";

import type { ReactNode } from "react";
import type { ApiPost } from "@/shared/api/api";

type FeedMasonryItemProps = {
  children: ReactNode;
  post: ApiPost;
  columnWidth: number | null;
  columns: number;
  isCommentsOpen: boolean;
  className?: string;
  onElement: (element: HTMLDivElement | null) => void;
};

// A smaller track makes the reserved card height follow its known aspect ratio
// more closely. It stays data-driven: unlike DOM measurement it cannot create
// a resize/scrollbar feedback loop.
const GRID_ROW_HEIGHT = 4;
const MOBILE_GRID_GAP = 10;
const DESKTOP_GRID_GAP = 16;
export const OPEN_COMMENTS_HEIGHT = 360;

function mediaAspectRatio(post: ApiPost): number {
  if (post.media_type === "STORY") return 3 / 4;
  if (post.media_width && post.media_height) {
    return post.media_width / post.media_height;
  }
  return post.media_type === "VIDEO" ? 16 / 9 : 3 / 4;
}

function mediaFooterHeight(post: ApiPost, isDesktop: boolean): number {
  if (post.media_type === "STORY" || !isDesktop) return 0;

  // Desktop captions sit below the image. Their lines are clamped, so this is
  // a stable upper bound known without measuring the rendered card.
  let height = 58;
  if (post.title) height += 42;
  if (post.text) height += 44;
  if (post.country || post.city || (post.lat != null && post.lng != null)) {
    height += 20;
  }
  return height;
}

function estimatedCardHeight(
  post: ApiPost,
  cardWidth: number,
  isDesktop: boolean,
  isCommentsOpen: boolean,
): number {
  const mediaHeight = cardWidth / mediaAspectRatio(post);
  const baseHeight =
    post.media_type === "STORY"
      ? Math.max(320, mediaHeight)
      : mediaHeight + mediaFooterHeight(post, isDesktop);

  return baseHeight + (isCommentsOpen ? OPEN_COMMENTS_HEIGHT + 1 : 0);
}

export function FeedMasonryItem({
  children,
  post,
  columnWidth,
  columns,
  isCommentsOpen,
  className = "",
  onElement,
}: FeedMasonryItemProps) {
  const featured = post.layout === "FEATURED" && post.media_type !== "STORY";
  const isDesktop = columns === 3;
  const columnSpan =
    (post.media_type === "STORY" && columns === 2) ||
    (featured && isDesktop)
      ? 2
      : 1;
  const gap = isDesktop ? DESKTOP_GRID_GAP : MOBILE_GRID_GAP;
  const cardWidth = columnWidth
    ? columnWidth * columnSpan + gap * (columnSpan - 1)
    : null;
  const estimatedHeight = cardWidth
    ? estimatedCardHeight(post, cardWidth, isDesktop, isCommentsOpen)
    : null;
  const rowSpan = estimatedHeight
    ? Math.max(1, Math.ceil((estimatedHeight + gap) / (GRID_ROW_HEIGHT + gap)))
    : null;

  return (
    <div
      ref={onElement}
      className={`min-w-0 ${
        post.media_type === "STORY"
          ? "sm:col-span-2 lg:col-span-1"
          : featured
            ? "lg:col-span-2"
            : ""
      } ${className}`}
      style={rowSpan ? { gridRowEnd: `span ${rowSpan}` } : undefined}
    >
      {children}
    </div>
  );
}
