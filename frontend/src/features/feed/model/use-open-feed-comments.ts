import { useCallback, useRef, useState } from "react";

export function useOpenFeedComments() {
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const postCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const openComments = useCallback(
    (postId: string) => {
      if (commentsPostId === postId) {
        setCommentsPostId(null);
        return;
      }

      const el = postCardRefs.current[postId];
      if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });

      setTimeout(() => setCommentsPostId(postId), 380);
    },
    [commentsPostId],
  );

  return {
    commentsPostId,
    postCardRefs,
    openComments,
  };
}
