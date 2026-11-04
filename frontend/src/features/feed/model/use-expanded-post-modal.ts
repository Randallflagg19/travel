import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiPost } from "@/shared/api/api";
import { isVideoFullscreen } from "./video-element";
import { attachmentFrame, postAttachments } from "./post-attachments";

type LoadedPosts = { items: ApiPost[]; hasMore: boolean; nextCursor: string | null };
type ExpandedPostPagination = {
  hasMore: boolean;
  loadMore: () => Promise<LoadedPosts>;
  loadMoreFailed: boolean;
};
export type ExpandedNavigationStatus = "ready" | "waiting" | "error" | "end";
type LoadMore = ExpandedPostPagination["loadMore"];
type LoadState = { loader: LoadMore; status: "loading" | "waiting" | "error" };
type PendingTransition = { postId: string };
// Replacing the session invalidates transitions from the previous post or feed.
type ViewerSession = {
  loader: LoadMore;
  pending: PendingTransition | null;
};

export function useExpandedPostModal(items: ApiPost[], { hasMore, loadMore, loadMoreFailed }: ExpandedPostPagination) {
  const [selection, setSelection] = useState<{ postId: string; attachmentId?: string } | null>(null);
  const expandedId = selection?.postId ?? null;
  const [expandedVideoSrc, setExpandedVideoSrc] = useState<string | null>(null);
  const [expandedPreviewSrc, setExpandedPreviewSrc] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState | null>(null);
  const loadStatus = loadState?.loader === loadMore ? loadState.status : "idle";
  const photoPreviewsRef = useRef(new Map<string, string>());
  const itemsRef = useRef(items);
  const sessionRef = useRef<ViewerSession | null>(null);
  const requestRef = useRef<{ loader: LoadMore; promise: Promise<LoadedPosts> } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldAutoPlayRef = useRef(false);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => {
    if (sessionRef.current && sessionRef.current.loader !== loadMore) {
      sessionRef.current = { loader: loadMore, pending: null };
    }
  }, [loadMore]);

  const publication = useMemo(
    () => items.find((post) => post.id === expandedId) ?? null,
    [expandedId, items],
  );
  const attachments = useMemo(() => publication ? postAttachments(publication) : [], [publication]);
  const attachmentIndex = Math.max(0, attachments.findIndex((media) => media.id === selection?.attachmentId));
  const expandedPost = useMemo(() => publication && attachments[attachmentIndex]
    ? attachmentFrame(publication, attachments[attachmentIndex]) : publication, [publication, attachments, attachmentIndex]);
  const isCarousel = attachments.length > 1;
  const mediaItems = useMemo(() => items.filter((post) => post.media_type !== "STORY"), [items]);
  const expandedMediaIndex = mediaItems.findIndex((post) => post.id === expandedId);
  const adjacentMedia = useMemo(() => {
    if (isCarousel && publication) {
      return [attachments[attachmentIndex + 1], attachments[attachmentIndex + 2], attachments[attachmentIndex - 1]]
        .filter((item) => Boolean(item)).map((item) => attachmentFrame(publication, item));
    }
    if (expandedMediaIndex < 0) return [];
    // Videos contribute nearby posters without reducing the two-photo lookahead.
    const next: ApiPost[] = [];
    let photos = 0;
    for (let index = expandedMediaIndex + 1;
      index < mediaItems.length && (photos < 2 || index <= expandedMediaIndex + 2); index++) {
      const post = mediaItems[index];
      if (post.media_type === "PHOTO") { next.push(post); photos++; }
      else if (post.media_type === "VIDEO" && index <= expandedMediaIndex + 2) next.push(post);
    }
    const previousPhoto = mediaItems.slice(0, expandedMediaIndex).findLast((post) => post.media_type === "PHOTO");
    const previous = mediaItems[expandedMediaIndex - 1];
    return [...next, previousPhoto, previous?.media_type === "VIDEO" ? previous : undefined]
      .filter((post): post is ApiPost => Boolean(post));
  }, [expandedMediaIndex, mediaItems, isCarousel, publication, attachments, attachmentIndex]);

  const rememberPhotoPreview = useCallback((originalUrl: string, previewSrc: string) => {
    photoPreviewsRef.current.set(originalUrl, previewSrc);
  }, []);

  const cancelPendingNavigation = useCallback(() => {
    if (sessionRef.current) sessionRef.current.pending = null;
    setLoadState((current) => current?.status === "waiting"
      ? { ...current, status: "loading" }
      : current);
  }, []);

  const showPost = useCallback((post: ApiPost, attachmentId?: string) => {
    cancelPendingNavigation();
    sessionRef.current = { loader: loadMore, pending: null };
    setLoadState((current) => current?.status === "error" ? null : current);
    videoRef.current?.pause();
    const media = postAttachments(post);
    const selected = media.find((item) => item.id === attachmentId) ?? media[0];
    const frame = selected ? attachmentFrame(post, selected) : post;
    setSelection({ postId: post.id, attachmentId: selected?.id });
    setExpandedPreviewSrc(photoPreviewsRef.current.get(frame.media_url ?? "") ?? null);
    setExpandedVideoSrc(frame.media_type === "VIDEO" ? frame.media_url : null);
    shouldAutoPlayRef.current = frame.media_type === "VIDEO";
  }, [cancelPendingNavigation, loadMore]);

  const openExpanded = useCallback((postId: string, attachmentId?: string) => {
    const post = itemsRef.current.find((item) => item.id === postId);
    if (post) showPost(post, attachmentId);
  }, [showPost]);

  const closeExpanded = useCallback(() => {
    cancelPendingNavigation();
    sessionRef.current = null;
    videoRef.current?.pause();
    setSelection(null);
    setExpandedVideoSrc(null);
    setExpandedPreviewSrc(null);
    shouldAutoPlayRef.current = false;
  }, [cancelPendingNavigation]);

  const requestMore = useCallback(() => {
    if (requestRef.current?.loader === loadMore) return requestRef.current.promise;
    setLoadState({ loader: loadMore, status: "loading" });
    const initialMediaCount = itemsRef.current.filter((post) => post.media_type !== "STORY").length;
    const promise = (async () => {
      let previousCursor: string | null | undefined;
      // A page containing only stories must not look like the end of the media gallery.
      for (;;) {
        const page = await loadMore();
        if (sessionRef.current?.loader !== loadMore) return page;
        if (!page.hasMore || page.items.filter((post) => post.media_type !== "STORY").length > initialMediaCount) return page;
        if (page.nextCursor === previousCursor) throw new Error("Pagination cursor did not advance");
        previousCursor = page.nextCursor;
      }
    })();
    requestRef.current = { loader: loadMore, promise };
    void promise.catch(() => {
      if (requestRef.current?.promise === promise && sessionRef.current?.loader === loadMore) {
        setLoadState({ loader: loadMore, status: "error" });
      }
    }).finally(() => {
      if (requestRef.current?.promise === promise) {
        requestRef.current = null;
        setLoadState((current) => current?.loader === loadMore && current.status !== "error"
          ? null
          : current);
      }
    });
    return promise;
  }, [loadMore]);

  const movePublication = useCallback((direction: -1 | 1) => {
    if (expandedId === null || expandedMediaIndex < 0 || isVideoFullscreen(videoRef.current)) return;
    if (direction === -1) {
      const previous = mediaItems[expandedMediaIndex - 1];
      if (previous) showPost(previous);
      else cancelPendingNavigation();
      return;
    }
    const session = sessionRef.current;
    if (!session || session.pending) return;
    const next = mediaItems[expandedMediaIndex + 1];
    if (next) { showPost(next); return; }
    if (!hasMore) return;

    const transition = { postId: expandedId };
    session.pending = transition;
    const request = requestMore();
    setLoadState({ loader: loadMore, status: "waiting" });
    void request.then((page) => {
      if (sessionRef.current !== session || session.pending !== transition || isVideoFullscreen(videoRef.current)) return;
      const media = page.items.filter((post) => post.media_type !== "STORY");
      const index = media.findIndex((post) => post.id === transition.postId);
      // Closing the viewer or changing the feed cancels the pending transition.
      if (!itemsRef.current.some((post) => post.id === transition.postId)) return;
      if (index >= 0 && media[index + 1]) showPost(media[index + 1]);
    }).catch(() => {}).finally(() => {
      if (session.pending === transition) session.pending = null;
    });
  }, [expandedMediaIndex, mediaItems, hasMore, expandedId, requestMore, showPost, loadMore, cancelPendingNavigation]);

  const moveExpanded = useCallback((direction: -1 | 1) => {
    if (!isCarousel) { movePublication(direction); return; }
    if (!publication || isVideoFullscreen(videoRef.current)) return;
    const next = attachments[attachmentIndex + direction];
    if (next) showPost(publication, next.id);
  }, [isCarousel, movePublication, publication, attachments, attachmentIndex, showPost]);

  useEffect(() => {
    if (expandedMediaIndex < 0 || !hasMore || loadMoreFailed || loadStatus !== "idle") return;
    if (mediaItems.length - expandedMediaIndex - 1 > 3) return;
    void requestMore().catch(() => {});
  }, [expandedMediaIndex, mediaItems.length, hasMore, loadMoreFailed, loadStatus, requestMore]);

  const retryLoadMore = useCallback(() => {
    if (expandedMediaIndex === mediaItems.length - 1) movePublication(1);
    else void requestMore().catch(() => {});
  }, [expandedMediaIndex, mediaItems.length, movePublication, requestMore]);

  const atEnd = expandedMediaIndex >= 0 && expandedMediaIndex === mediaItems.length - 1 && !hasMore &&
    (!isCarousel || attachmentIndex === attachments.length - 1);
  const failed = loadStatus === "error" || (loadStatus === "idle" && loadMoreFailed);
  const navigationStatus: ExpandedNavigationStatus = loadStatus === "waiting"
    ? "waiting"
    : failed ? "error" : atEnd ? "end" : "ready";

  return {
    expandedPost, expandedVideoSrc, expandedPreviewSrc, rememberPhotoPreview, adjacentMedia,
    videoRef, shouldAutoPlayRef, openExpanded, closeExpanded, moveExpanded, cancelPendingNavigation,
    attachmentIndex, attachmentCount: attachments.length, isCarousel, movePublication,
    canMoveToPreviousPublication: expandedMediaIndex > 0,
    canMoveToNextPublication: expandedMediaIndex >= 0 && (expandedMediaIndex < mediaItems.length - 1 || hasMore) && loadStatus !== "waiting",
    canMoveBackward: isCarousel ? attachmentIndex > 0 : expandedMediaIndex > 0,
    canMoveForward: isCarousel ? attachmentIndex < attachments.length - 1 : expandedMediaIndex >= 0 && (expandedMediaIndex < mediaItems.length - 1 || hasMore) && loadStatus !== "waiting",
    navigationStatus, retryLoadMore,
  };
}
