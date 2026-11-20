import { useCallback, useRef, useState } from "react";

export function useOpenFeedComments() {
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const commentsPostIdRef = useRef<string | null>(null);
  const postCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const openComments = useCallback(
    (postId: string) => {
      if (commentsPostIdRef.current === postId) {
        commentsPostIdRef.current = null;
        setCommentsPostId(null);
        return;
      }

      const el = postCardRefs.current[postId];
      if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });

      setTimeout(() => {
        commentsPostIdRef.current = postId;
        setCommentsPostId(postId);
      }, 380);
    },
    [],
  );

  return {
    commentsPostId,
    postCardRefs,
    openComments,
  };
}
