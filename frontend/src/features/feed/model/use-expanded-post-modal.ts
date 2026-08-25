import { useCallback, useMemo, useRef, useState } from "react";
import type { ApiPost } from "@/shared/api/api";
import { useExpandedModalBehavior } from "./use-expanded-modal-behavior";

export function useExpandedPostModal(items: ApiPost[]) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedVideoSrc, setExpandedVideoSrc] = useState<string | null>(null);

  const lastVideoTapRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldAutoPlayRef = useRef(false);

  const expandedPost = useMemo(() => {
    if (!expandedId) return null;
    return items.find((post) => post.id === expandedId) ?? null;
  }, [expandedId, items]);

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
    setExpandedId(null);
    setExpandedVideoSrc(null);
    shouldAutoPlayRef.current = false;
  }, []);

  useExpandedModalBehavior(Boolean(expandedId), closeExpanded);

  return {
    expandedPost,
    expandedVideoSrc,
    videoRef,
    shouldAutoPlayRef,
    lastVideoTapRef,
    openExpanded,
    closeExpanded,
  };
}
