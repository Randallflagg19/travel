"use client";

import { ApiPost } from "@/shared/api/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { likePost, unlikePost } from "@/shared/api/api";

type LikeProps = {
  canLike: boolean;
  accessToken: string | null;
  onLikeToggled: (postId: string, liked: boolean, deltaCount: number) => void;
  onLikeSuccess?: () => void;
  liked: boolean;
  post: ApiPost;
};

export function usePostLikeToggle({
  canLike,
  accessToken,
  onLikeToggled,
  onLikeSuccess,
  liked,
  post,
}: LikeProps) {
  const router = useRouter();
  const [likePending, setLikePending] = useState(false);

  async function toggleLike() {
    if (likePending) return;

    if (!canLike || !accessToken) {
      router.push("/login");
      return;
    }

    const nextLiked = !liked;
    const delta = nextLiked ? 1 : -1;

    onLikeToggled(post.id, nextLiked, delta);
    setLikePending(true);

    try {
      if (nextLiked) await likePost(accessToken, post.id);
      else await unlikePost(accessToken, post.id);

      onLikeSuccess?.();
    } catch {
      onLikeToggled(post.id, liked, -delta);
    } finally {
      setLikePending(false);
    }
  }

  return { likePending, toggleLike };
}
