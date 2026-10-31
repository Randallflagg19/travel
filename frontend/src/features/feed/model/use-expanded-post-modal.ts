import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiPost } from "@/shared/api/api";

export function useExpandedPostModal(items: ApiPost[]) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedVideoSrc, setExpandedVideoSrc] = useState<string | null>(null);
  const [expandedPreviewSrc, setExpandedPreviewSrc] = useState<string | null>(null);
  const photoPreviewsRef = useRef(new Map<string, string>());
  const itemsRef = useRef(items);

  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldAutoPlayRef = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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

  const rememberPhotoPreview = useCallback((originalUrl: string, previewSrc: string) => {
    photoPreviewsRef.current.set(originalUrl, previewSrc);
  }, []);

  const openExpanded = useCallback(
    (postId: string) => {
      const post = itemsRef.current.find((item) => item.id === postId);

      setExpandedId(postId);
      setExpandedPreviewSrc(photoPreviewsRef.current.get(post?.media_url ?? "") ?? null);

      if (post?.media_type === "VIDEO") {
        setExpandedVideoSrc(post.media_url);
        shouldAutoPlayRef.current = true;
        return;
      }

      setExpandedVideoSrc(null);
      shouldAutoPlayRef.current = false;
    },
    [],
  );

  const closeExpanded = useCallback(() => {
    videoRef.current?.pause();
    setExpandedId(null);
    setExpandedVideoSrc(null);
    setExpandedPreviewSrc(null);
    shouldAutoPlayRef.current = false;
  }, []);

  const moveExpanded = useCallback((direction: -1 | 1) => {
    if (expandedMediaIndex < 0 || mediaItems.length < 2) return;
    const next = (expandedMediaIndex + direction + mediaItems.length) % mediaItems.length;
    const post = mediaItems[next];
    videoRef.current?.pause();
    setExpandedId(post.id);
    setExpandedPreviewSrc(photoPreviewsRef.current.get(post.media_url ?? "") ?? null);
    setExpandedVideoSrc(post.media_type === "VIDEO" ? post.media_url : null);
    shouldAutoPlayRef.current = post.media_type === "VIDEO";
  }, [expandedMediaIndex, mediaItems]);

  return {
    expandedPost,
    expandedVideoSrc,
    expandedPreviewSrc,
    rememberPhotoPreview,
    videoRef,
    shouldAutoPlayRef,
    openExpanded,
    closeExpanded,
    moveExpanded,
    canMoveExpanded: expandedMediaIndex >= 0 && mediaItems.length > 1,
  };
}
