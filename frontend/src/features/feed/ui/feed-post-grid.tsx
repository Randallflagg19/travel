"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiPost, AuthUser } from "@/shared/api/api";
import { useFeedPermissions } from "../model/use-feed-permissions";
import type { FeedPostActions } from "../model/use-feed-post-actions";
import { useOpenFeedComments } from "../model/use-open-feed-comments";
import { FeedMasonryItem } from "./feed-masonry-item";
import { FeedPostCard } from "./feed-post-card";

type FeedPostGridProps = {
  visible: boolean;
  items: ApiPost[];
  deleteMode: boolean;
  showPlaceInCard: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  actions: FeedPostActions;
  onOpen: (postId: string) => void;
  onPhotoPreviewReady: (originalUrl: string, previewSrc: string) => void;
};

export function FeedPostGrid({
  visible, items, deleteMode, showPlaceInCard, user, accessToken, actions, onOpen, onPhotoPreviewReady,
}: FeedPostGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [actionsPostId, setActionsPostId] = useState<string | null>(null);
  const [gridMetrics, setGridMetrics] = useState<{
    columnWidth: number | null;
    columns: number;
  }>({ columnWidth: null, columns: 1 });
  const { commentsPostId, postCardRefs, openComments } = useOpenFeedComments();
  const { canLike, canComment } = useFeedPermissions(user);

  const updateGridMetrics = useCallback((element?: HTMLDivElement | null) => {
    const grid = element ?? gridRef.current;
    if (!grid) return;

    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const isTablet = window.matchMedia("(min-width: 640px)").matches;
    const columns = isDesktop ? 3 : isTablet ? 2 : 1;
    const gap = isDesktop ? 16 : 10;
    const width = Math.round(grid.getBoundingClientRect().width);
    const columnWidth = Math.max(0, (width - gap * (columns - 1)) / columns);

    setGridMetrics((current) =>
      current.columns === columns && current.columnWidth === columnWidth
        ? current
        : { columns, columnWidth },
    );
  }, []);

  const setGridRef = useCallback(
    (element: HTMLDivElement | null) => {
      gridRef.current = element;
      // Measure on mount so saved media proportions reserve card height immediately.
      if (element) updateGridMetrics(element);
    },
    [updateGridMetrics],
  );

  const handleWindowResize = useCallback(() => {
    updateGridMetrics();
  }, [updateGridMetrics]);

  useEffect(() => {
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [handleWindowResize]);

  // Keep card interaction state while the page shows loading, empty, or error states.
  if (!visible) return null;

  return (
    <div
      ref={setGridRef}
      className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4 ${
        gridMetrics.columnWidth !== null
          ? "grid-flow-row-dense auto-rows-[4px]"
          : "invisible"
      }`}
    >
      {items.map((post) => (
        <FeedMasonryItem
          key={post.id}
          post={post}
          columnWidth={gridMetrics.columnWidth}
          columns={gridMetrics.columns}
          isCommentsOpen={commentsPostId === post.id}
          onElement={(el) => {
            postCardRefs.current[post.id] = el;
          }}
        >
          <FeedPostCard
            post={post}
            deleteMode={deleteMode}
            canDelete={actions.canManagePost(post)}
            canEdit={actions.canManagePost(post)}
            onDelete={actions.onDelete}
            onEdit={actions.onEdit}
            onToggleFeatured={actions.onToggleFeatured}
            onTogglePinned={actions.onTogglePinned}
            isActionsOpen={actionsPostId === post.id}
            onActionsOpenChange={(open) =>
              setActionsPostId(open ? post.id : null)
            }
            onOpen={onOpen}
            onPhotoPreviewReady={onPhotoPreviewReady}
            showPlaceInCard={showPlaceInCard}
            canLike={canLike}
            canComment={canComment && (user?.role !== "AUTHOR" || user.id === post.user_id)}
            isCommentsOpen={commentsPostId === post.id}
            currentUserId={user?.id ?? null}
            accessToken={accessToken}
            onLikeToggled={actions.onLikeToggled}
            onLikeSuccess={actions.onPostsChanged}
            onOpenComments={openComments}
            onCommentAdded={actions.onPostsChanged}
          />
        </FeedMasonryItem>
      ))}
    </div>
  );
}
