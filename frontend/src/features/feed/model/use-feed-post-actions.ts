import { useCallback, useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { deletePost, setPostPinned, updatePostMetadata, type ApiPost, type AuthUser } from "@/shared/api/api";
import type { FeedOrder } from "./use-feed-params";
import type { PostsInfiniteData } from "./use-feed-posts";

export type FeedPostActions = {
  canManagePost: (post: ApiPost) => boolean;
  onDelete: (postId: string) => void;
  onEdit: (post: ApiPost) => void;
  onToggleFeatured: (post: ApiPost) => void;
  onTogglePinned: (post: ApiPost) => void;
  onLikeToggled: (postId: string, liked: boolean, deltaCount: number) => void;
  onPostsChanged: () => void;
};

type FeedPostActionsOptions = {
  items: ApiPost[];
  postsQueryKey: QueryKey;
  order: FeedOrder;
  user: AuthUser | null;
  accessToken: string | null;
};

function sortPosts(posts: ApiPost[], order: FeedOrder): ApiPost[] {
  const direction = order === "asc" ? 1 : -1;
  return [...posts].sort((left, right) => {
    if (left.pinned_at && !right.pinned_at) return -1;
    if (!left.pinned_at && right.pinned_at) return 1;
    if (left.pinned_at && right.pinned_at) {
      const byPinnedAt = right.pinned_at.localeCompare(left.pinned_at);
      if (byPinnedAt !== 0) return byPinnedAt;
    }
    const byCreatedAt = left.created_at.localeCompare(right.created_at);
    if (byCreatedAt !== 0) return byCreatedAt * direction;
    return left.id.localeCompare(right.id) * direction;
  });
}

export function useFeedPostActions({ items, postsQueryKey, order, user, accessToken }: FeedPostActionsOptions) {
  const queryClient = useQueryClient();
  const [editingPost, setEditingPost] = useState<ApiPost | null>(null);

  const canManagePost = useCallback((post: ApiPost) => Boolean(
    user && (
      user.role === "SUPERADMIN" ||
      user.role === "ADMIN" ||
      (user.role === "AUTHOR" && user.id === post.user_id)
    )
  ), [user]);

  const updatePostsCache = useCallback(
    (update: (post: ApiPost) => ApiPost | null) => {
      queryClient.setQueryData<PostsInfiniteData>(postsQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.flatMap((post) => {
              const nextPost = update(post);
              return nextPost ? [nextPost] : [];
            }),
          })),
        };
      });
    },
    [postsQueryKey, queryClient],
  );

  const handleDeletePost = useCallback(async (postId: string) => {
    const targetPost = items.find((post) => post.id === postId);
    if (!accessToken || !targetPost || !canManagePost(targetPost)) return;
    if (!confirm("Удалить пост? Файл будет удалён из Cloudinary и из ленты."))
      return;
    const previousPosts = queryClient.getQueryData<PostsInfiniteData>(postsQueryKey);
    updatePostsCache((post) => (post.id === postId ? null : post));
    try {
      await deletePost(accessToken, postId);
      await queryClient.invalidateQueries({ queryKey: ["places"] });
    } catch (e) {
      queryClient.setQueryData(postsQueryKey, previousPosts);
      alert(e instanceof Error ? e.message : "Не удалось удалить");
    }
  }, [accessToken, items, canManagePost, postsQueryKey, queryClient, updatePostsCache]);

  async function handleMetadataSave(value: { title: string; text: string }) {
    if (!editingPost || !accessToken || !canManagePost(editingPost)) return;
    const postId = editingPost.id;
    const previousPosts = queryClient.getQueryData<PostsInfiniteData>(postsQueryKey);
    updatePostsCache((post) =>
      post.id === postId
        ? { ...post, title: value.title || null, text: value.text || null }
        : post,
    );
    setEditingPost(null);
    try {
      const { post: savedPost } = await updatePostMetadata(accessToken, postId, {
        title: value.title || null,
        text: value.text || null,
      });
      updatePostsCache((post) => (post.id === postId ? savedPost : post));
    } catch (error) {
      queryClient.setQueryData(postsQueryKey, previousPosts);
      console.error("updatePostMetadata failed", error);
      alert("Не удалось сохранить изменения. Попробуйте ещё раз.");
    }
  }

  const handleToggleFeatured = useCallback(async (post: ApiPost) => {
    if (!accessToken || !canManagePost(post)) return;
    const layout = post.layout === "FEATURED" ? "STANDARD" : "FEATURED";
    const previousPosts = queryClient.getQueryData<PostsInfiniteData>(postsQueryKey);
    updatePostsCache((cachedPost) =>
      cachedPost.id === post.id ? { ...cachedPost, layout } : cachedPost,
    );
    try {
      const { post: savedPost } = await updatePostMetadata(accessToken, post.id, {
        layout,
      });
      updatePostsCache((cachedPost) =>
        cachedPost.id === post.id ? savedPost : cachedPost,
      );
    } catch (error) {
      queryClient.setQueryData(postsQueryKey, previousPosts);
      console.error("update post layout failed", error);
      alert("Не удалось изменить размер карточки. Попробуйте ещё раз.");
    }
  }, [accessToken, canManagePost, postsQueryKey, queryClient, updatePostsCache]);

  const handleTogglePinned = useCallback(async (post: ApiPost) => {
    if (!accessToken || !canManagePost(post)) return;
    const pinned = !post.pinned_at;
    const previousPosts = queryClient.getQueryData<PostsInfiniteData>(postsQueryKey);

    queryClient.setQueryData<PostsInfiniteData>(postsQueryKey, (old) => {
      if (!old) return old;
      const pageSizes = old.pages.map((page) => page.items.length);
      const sorted = sortPosts(
        old.pages
          .flatMap((page) => page.items)
          .map((cachedPost) =>
            cachedPost.id === post.id
              ? {
                  ...cachedPost,
                  pinned_at: pinned ? new Date().toISOString() : null,
                }
              : cachedPost,
          ),
        order,
      );
      let offset = 0;
      return {
        ...old,
        pages: old.pages.map((page, index) => {
          const items = sorted.slice(offset, offset + pageSizes[index]);
          offset += pageSizes[index];
          return { ...page, items };
        }),
      };
    });

    try {
      const { post: savedPost } = await setPostPinned(
        accessToken,
        post.id,
        pinned,
      );
      updatePostsCache((cachedPost) =>
        cachedPost.id === post.id
          ? { ...cachedPost, pinned_at: savedPost.pinned_at }
          : cachedPost,
      );
    } catch (error) {
      queryClient.setQueryData(postsQueryKey, previousPosts);
      console.error("setPostPinned failed", error);
      alert("Не удалось изменить закрепление. Попробуйте ещё раз.");
    } finally {
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
    }
  }, [accessToken, canManagePost, order, postsQueryKey, queryClient, updatePostsCache]);

  const updatePostLike = useCallback((postId: string, liked: boolean, deltaCount: number) => {
    updatePostsCache((post) => post.id === postId
      ? { ...post, liked_by_me: liked, like_count: Math.max(0, post.like_count + deltaCount) }
      : post);
  }, [updatePostsCache]);

  const onPostsChanged = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
  }, [queryClient]);

  const postActions: FeedPostActions = {
    canManagePost,
    onDelete: handleDeletePost,
    onEdit: setEditingPost,
    onToggleFeatured: handleToggleFeatured,
    onTogglePinned: handleTogglePinned,
    onLikeToggled: updatePostLike,
    onPostsChanged,
  };

  return { editingPost, setEditingPost, saveMetadata: handleMetadataSave, postActions };
}
