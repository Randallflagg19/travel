"use client";

import { FeedExpandedModal } from "./feed-expanded-modal";
import type { useExpandedPostModal } from "../model/use-expanded-post-modal";

type MediaViewerState = ReturnType<typeof useExpandedPostModal>;

/** Keep media elements, playback refs and frame navigation inside this feature. */
export function MediaViewer({ viewer }: { viewer: MediaViewerState }) {
  const post = viewer.expandedPost;
  if (!post) return null;

  return (
    <FeedExpandedModal
      post={post}
      onClose={viewer.closeExpanded}
      expandedVideoSrc={viewer.expandedVideoSrc}
      previewSrc={viewer.expandedPreviewSrc}
      adjacentMedia={viewer.adjacentMedia}
      videoRef={viewer.videoRef}
      shouldAutoPlayRef={viewer.shouldAutoPlayRef}
      onMove={viewer.moveExpanded}
      onCancelPendingNavigation={viewer.cancelPendingNavigation}
      canMoveBackward={viewer.canMoveBackward}
      canMoveForward={viewer.canMoveForward}
      navigationStatus={viewer.navigationStatus}
      onRetryLoadMore={viewer.retryLoadMore}
      attachmentIndex={viewer.attachmentIndex}
      attachmentCount={viewer.attachmentCount}
      isCarousel={viewer.isCarousel}
      onSelectAttachment={(id) => viewer.openExpanded(post.id, id)}
      onMovePublication={viewer.movePublication}
      canMoveToPreviousPublication={viewer.canMoveToPreviousPublication}
      canMoveToNextPublication={viewer.canMoveToNextPublication}
    />
  );
}
