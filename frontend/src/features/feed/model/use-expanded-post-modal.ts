import { useCallback, useMemo, useRef, useState } from "react";
import type { ApiPost } from "@/shared/api/api";
import { useExpandedModalBehavior } from "./use-expanded-modal-behavior";

export function useExpandedPostModal(items: ApiPost[]) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedVideoSrc, setExpandedVideoSrc] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldAutoPlayRef = useRef(false);

  const expandedPost = useMemo(() => {
    if (!expandedId) return null;
    return items.find((post) => post.id === expandedId) ?? null;
  }, [expandedId, items]);
  const mediaItems = useMemo(
    () => items.filter((post) => post.media_type !== "STORY"),
    [items],
  );
  const expandedMediaIndex = expandedPost
    ? mediaItems.findIndex((post) => post.id === expandedPost.id)
    : -1;

  const openExpanded = useCallback(
    (postId: string) => {
      const post = items.find((item) => item.id === postId);

      setExpandedId(postId);

      if (post?.media_type === "VIDEO") {
        setExpandedVideoSrc(post.media_url);
        shouldAutoPlayRef.current = true;
        return;
      }

      setExpandedVideoSrc(null);
      shouldAutoPlayRef.current = false;
    },
    [items],
  );

  const closeExpanded = useCallback(() => {
    videoRef.current?.pause();
    setExpandedId(null);
    setExpandedVideoSrc(null);
    shouldAutoPlayRef.current = false;
  }, []);

  const moveExpanded = useCallback((direction: -1 | 1) => {
    if (expandedMediaIndex < 0 || mediaItems.length < 2) return;
    const next = (expandedMediaIndex + direction + mediaItems.length) % mediaItems.length;
    const post = mediaItems[next];
    setExpandedId(post.id);
    setExpandedVideoSrc(post.media_type === "VIDEO" ? post.media_url : null);
    shouldAutoPlayRef.current = post.media_type === "VIDEO";
  }, [expandedMediaIndex, mediaItems]);

  useExpandedModalBehavior(Boolean(expandedId), closeExpanded);

  return {
    expandedPost,
    expandedVideoSrc,
    videoRef,
    shouldAutoPlayRef,
    openExpanded,
    closeExpanded,
    moveExpanded,
    canMoveExpanded: expandedMediaIndex >= 0 && mediaItems.length > 1,
  };
}
