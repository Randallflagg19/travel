"use client";

import type { ReactNode } from "react";
import type { ApiPost } from "@/shared/api/api";

type FeedMasonryItemProps = {
  children: ReactNode;
  post: ApiPost;
  columnWidth: number | null;
  isDesktop: boolean;
  className?: string;
  onElement: (element: HTMLDivElement | null) => void;
};

const GRID_ROW_HEIGHT = 8;
const MOBILE_GRID_GAP = 10;
const DESKTOP_GRID_GAP = 16;

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

export function FeedMasonryItem({
  children,
  post,
  columnWidth,
  isDesktop,
  className = "",
  onElement,
}: FeedMasonryItemProps) {
  const featured = post.layout === "FEATURED" && post.media_type !== "STORY";
  const columnSpan = featured ? 2 : 1;
  const gap = isDesktop ? DESKTOP_GRID_GAP : MOBILE_GRID_GAP;
  const cardWidth = columnWidth
    ? columnWidth * columnSpan + gap * (columnSpan - 1)
    : null;
  const estimatedHeight = cardWidth
    ? cardWidth / mediaAspectRatio(post) + mediaFooterHeight(post, isDesktop)
    : null;
  const rowSpan = estimatedHeight
    ? Math.max(1, Math.ceil((estimatedHeight + gap) / (GRID_ROW_HEIGHT + gap)))
    : null;

  return (
    <div
      ref={onElement}
      className={`min-w-0 ${featured ? "col-span-2" : ""} ${className}`}
      style={rowSpan ? { gridRowEnd: `span ${rowSpan}` } : undefined}
    >
      {children}
    </div>
  );
}
