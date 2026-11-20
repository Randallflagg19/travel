import type { ApiPost } from "@/shared/api/api";

export type FeedPostActions = {
  canManagePost: (post: ApiPost) => boolean;
  onDelete: (postId: string) => void;
  onEdit: (post: ApiPost) => void;
  onToggleFeatured: (post: ApiPost) => void;
  onTogglePinned: (post: ApiPost) => void;
  onLikeToggled: (postId: string, liked: boolean, deltaCount: number) => void;
  onPostsChanged: () => void;
};

