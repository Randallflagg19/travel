import { useCallback, useRef, useState } from "react";
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
    return byCreatedAt !== 0 ? byCreatedAt * direction : left.id.localeCompare(right.id) * direction;
  });
}

export function useFeedPostActions({ items, postsQueryKey, order, user, accessToken }: FeedPostActionsOptions) {
  const queryClient = useQueryClient();
  const [editingPost, setEditingPost] = useState<ApiPost | null>(null);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [deletingPost, setDeletingPost] = useState<ApiPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const deletionInFlight = useRef(false);
  const pending = useRef(new Set<string>());

  const canManagePost = useCallback((post: ApiPost) => Boolean(user && (
    user.role === "SUPERADMIN" || user.role === "ADMIN" || (user.role === "AUTHOR" && user.id === post.user_id)
  )), [user]);

  const updatePostsCache = useCallback((update: (post: ApiPost) => ApiPost | null) => {
    queryClient.setQueryData<PostsInfiniteData>(postsQueryKey, (old) => old ? {
      ...old,
      pages: old.pages.map((page) => ({ ...page, items: page.items.flatMap((post) => {
        const next = update(post);
        return next ? [next] : [];
      }) })),
    } : old);
  }, [postsQueryKey, queryClient]);

  const handleDeletePost = useCallback((postId: string) => {
    const target = items.find((post) => post.id === postId);
    if (!accessToken || !target || !canManagePost(target) || deletionInFlight.current) return;
    setDeletingPost(target);
    setDeleteError(null);
    setDeleteNotice(null);
  }, [accessToken, items, canManagePost]);

  function closeDeleteDialog() {
    if (deletionInFlight.current) return;
    setDeletingPost(null);
    setDeleteError(null);
  }

  async function confirmDeletePost() {
    if (!deletingPost || deletionInFlight.current) return;
    if (!accessToken || !canManagePost(deletingPost)) {
      setDeleteError("Недостаточно прав для удаления публикации. Войдите в аккаунт ещё раз.");
      return;
    }
    const postId = deletingPost.id;
    if (pending.current.has(postId)) {
      setDeleteError("Дождитесь завершения предыдущего изменения этой публикации.");
      return;
    }
    deletionInFlight.current = true;
    pending.current.add(postId);
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePost(accessToken, postId);
      updatePostsCache((post) => post.id === postId ? null : post);
      void queryClient.invalidateQueries({ queryKey: ["places"] });
      setDeletingPost(null);
      setDeleteNotice("Публикация удалена");
    } catch {
      setDeleteError("Не удалось удалить публикацию. Попробуйте ещё раз.");
    } finally {
      deletionInFlight.current = false;
      pending.current.delete(postId);
      setDeleting(false);
    }
  }

  async function handleMetadataSave(value: { title: string; text: string }) {
    if (!editingPost || !accessToken || !canManagePost(editingPost)) return;
    const target = editingPost;
    if (pending.current.has(target.id)) throw new Error("Дождитесь завершения предыдущего изменения этой публикации.");
    pending.current.add(target.id);
    setMetadataSaving(true);
    try {
      const { post: saved } = await updatePostMetadata(accessToken, target.id, { title: value.title || null, text: value.text || null });
      // Merge only this operation's fields into the CURRENT cache, including newer reactions/pages.
      updatePostsCache((post) => post.id === target.id ? { ...post, title: saved.title, text: saved.text } : post);
      setEditingPost((current) => current === target ? null : current);
    } finally {
      pending.current.delete(target.id);
      setMetadataSaving(false);
    }
  }

  const handleToggleFeatured = useCallback(async (post: ApiPost) => {
    if (!accessToken || !canManagePost(post) || pending.current.has(post.id)) return;
    pending.current.add(post.id);
    try {
      const layout = post.layout === "FEATURED" ? "STANDARD" : "FEATURED";
      const { post: saved } = await updatePostMetadata(accessToken, post.id, { layout });
      updatePostsCache((current) => current.id === post.id ? { ...current, layout: saved.layout } : current);
    } catch {
      alert("Не удалось изменить размер карточки. Попробуйте ещё раз.");
    } finally {
      pending.current.delete(post.id);
    }
  }, [accessToken, canManagePost, updatePostsCache]);

  const handleTogglePinned = useCallback(async (post: ApiPost) => {
    if (!accessToken || !canManagePost(post) || pending.current.has(post.id)) return;
    pending.current.add(post.id);
    try {
      const { post: saved } = await setPostPinned(accessToken, post.id, !post.pinned_at);
      queryClient.setQueryData<PostsInfiniteData>(postsQueryKey, (old) => {
        if (!old) return old;
        const sorted = sortPosts(old.pages.flatMap((page) => page.items).map((current) =>
          current.id === post.id ? { ...current, pinned_at: saved.pinned_at } : current), order);
        let offset = 0;
        return { ...old, pages: old.pages.map((page) => {
          const items = sorted.slice(offset, offset + page.items.length);
          offset += page.items.length;
          return { ...page, items };
        }) };
      });
      void queryClient.invalidateQueries({ queryKey: postsQueryKey });
    } catch {
      alert("Не удалось изменить закрепление. Попробуйте ещё раз.");
    } finally {
      pending.current.delete(post.id);
    }
  }, [accessToken, canManagePost, order, postsQueryKey, queryClient]);

  const updatePostLike = useCallback((postId: string, liked: boolean, deltaCount: number) => {
    updatePostsCache((post) => post.id === postId
      ? { ...post, liked_by_me: liked, like_count: Math.max(0, post.like_count + deltaCount) } : post);
  }, [updatePostsCache]);
  const onPostsChanged = useCallback(() => { void queryClient.invalidateQueries({ queryKey: ["posts"] }); }, [queryClient]);

  const postActions: FeedPostActions = {
    canManagePost, onDelete: handleDeletePost, onEdit: setEditingPost,
    onToggleFeatured: handleToggleFeatured, onTogglePinned: handleTogglePinned,
    onLikeToggled: updatePostLike, onPostsChanged,
  };
  return {
    editingPost, setEditingPost, metadataSaving, saveMetadata: handleMetadataSave, postActions,
    deletingPost, deleting, deleteError, confirmDeletePost, closeDeleteDialog,
    deleteNotice, clearDeleteNotice: () => setDeleteNotice(null),
  };
}
