"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchPostsPage,
  deletePost,
  type ApiPost,
} from "@/shared/api/api";
import { useInView } from "@/shared/lib/hooks/use-in-view";
import { useAuth } from "@/entities/session/model/auth";
import { Card, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { FeedHeader, FeedEmptyState } from "./feed-header";
import { FeedPostCard } from "./feed-post-card";
import { FeedExpandedModal } from "./feed-expanded-modal";

export function Feed() {
  const limit = 30;
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const order: "asc" | "desc" =
    searchParams.get("order") === "desc" ? "desc" : "asc";
  const deleteMode = searchParams.get("delete") === "1";
  const canDelete = Boolean(
    auth.user &&
    (auth.user.role === "ADMIN" || auth.user.role === "SUPERADMIN"),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedVideoSrc, setExpandedVideoSrc] = useState<string | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const postCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollYRef = useRef(0);
  const lastVideoTapRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldAutoPlayRef = useRef(false);

  const selectedCountry = searchParams.get("country") ?? "";
  const selectedCity = searchParams.get("city") ?? "";
  const unknown = searchParams.get("unknown") === "true";
  const all = searchParams.get("all") === "true";

  const headerTitle = unknown
    ? "Unknown"
    : all
      ? "Все посты"
      : selectedCountry && selectedCity
        ? `${selectedCountry} / ${selectedCity}`
        : "Места";

  const isSelectionReady = Boolean(
    all || unknown || (selectedCountry && selectedCity),
  );

  const postsQuery = useInfiniteQuery({
    queryKey: [
      "posts",
      {
        limit,
        order,
        country: selectedCountry,
        city: selectedCity,
        unknown,
        all,
        accessToken: auth.accessToken ?? null,
      },
    ],
    queryFn: ({ pageParam }) =>
      fetchPostsPage(
        {
          limit,
          cursor: typeof pageParam === "string" ? pageParam : undefined,
          order,
          ...(unknown
            ? { unknown: true }
            : all
              ? {}
              : selectedCountry && selectedCity
                ? { country: selectedCountry, city: selectedCity }
                : {}),
        },
        auth.accessToken ?? undefined,
      ),
    enabled: Boolean(isSelectionReady && auth.hydrated),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
  });

  const items = useMemo(
    () => postsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [postsQuery.data],
  );

  const expandedPost = useMemo(() => {
    if (!expandedId) return null;
    return items.find((p) => p.id === expandedId) ?? null;
  }, [expandedId, items]);

  const inViewOptions = useMemo(() => ({ rootMargin: "600px" }), []);
  const { ref: sentinelRef, inView } = useInView<HTMLDivElement>(inViewOptions);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = postsQuery;

  const openExpanded = useCallback(
    (id: string) => {
      const post = items.find((p) => p.id === id);
      setExpandedId(id);
      if (post?.media_type === "VIDEO") {
        setExpandedVideoSrc(post.media_url);
        shouldAutoPlayRef.current = true;
      } else {
        setExpandedVideoSrc(null);
        shouldAutoPlayRef.current = false;
      }
    },
    [items],
  );

  const closeExpanded = useCallback(() => {
    setExpandedId(null);
    setExpandedVideoSrc(null);
    shouldAutoPlayRef.current = false;
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (!hasNextPage) return;
    if (isFetchingNextPage) return;
    void fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Close expanded view with ESC.
  useEffect(() => {
    if (!expandedId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeExpanded();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedId, closeExpanded]);

  // Prevent scroll jumps: lock scroll while expanded and restore on close.
  useEffect(() => {
    if (!expandedId) return;
    scrollYRef.current = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.width = "100%";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, scrollYRef.current);
    };
  }, [expandedId]);

  function setOrder(next: "asc" | "desc") {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("order", next);
    router.push(`/?${nextParams.toString()}`);
  }

  async function handleDeletePost(postId: string) {
    if (!auth.accessToken || !canDelete) return;
    if (!confirm("Удалить пост? Файл будет удалён из Cloudinary и из ленты."))
      return;
    try {
      await deletePost(auth.accessToken, postId);
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      await queryClient.invalidateQueries({ queryKey: ["places"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось удалить");
    }
  }

  const canLike = Boolean(
    auth.user &&
      (auth.user.role === "USER" ||
        auth.user.role === "ADMIN" ||
        auth.user.role === "SUPERADMIN"),
  );

  const canComment = Boolean(
    auth.user &&
      (auth.user.role === "ADMIN" || auth.user.role === "SUPERADMIN"),
  );

  const updatePostLike = useCallback(
    (postId: string, liked: boolean, deltaCount: number) => {
      queryClient.setQueryData(
        [
          "posts",
          {
            limit,
            order,
            country: selectedCountry,
            city: selectedCity,
            unknown,
            all,
            accessToken: auth.accessToken ?? null,
          },
        ],
        (old: { pages: { items: ApiPost[]; nextCursor: string | null; hasMore: boolean }[]; pageParams: unknown[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) =>
                p.id === postId
                  ? {
                      ...p,
                      liked_by_me: liked,
                      like_count: Math.max(0, p.like_count + deltaCount),
                    }
                  : p,
              ),
            })),
          };
        },
      );
    },
    [
      queryClient,
      limit,
      order,
      selectedCountry,
      selectedCity,
      unknown,
      all,
      auth.accessToken,
    ],
  );

  const showPlaceInCard = Boolean(
    !unknown && !all && !(selectedCountry && selectedCity),
  );

  const openComments = useCallback((postId: string) => {
    if (commentsPostId === postId) {
      setCommentsPostId(null);
      return;
    }
    const el = postCardRefs.current[postId];
    if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
    setTimeout(() => setCommentsPostId(postId), 380);
  }, [commentsPostId]);

  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 overflow-x-hidden px-4 py-10">
      <FeedHeader
        headerTitle={headerTitle}
        isSelectionReady={Boolean(isSelectionReady)}
        order={order}
        onOrderChange={setOrder}
      />

      <FeedEmptyState isSelectionReady={Boolean(isSelectionReady)} />

      {postsQuery.isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Загрузка…</CardTitle>
            <CardDescription>Тянем первую страницу постов.</CardDescription>
          </CardHeader>
        </Card>
      ) : postsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Ошибка</CardTitle>
            <CardDescription>
              {postsQuery.error instanceof Error
                ? postsQuery.error.message
                : "Не удалось загрузить посты"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Пока пусто</CardTitle>
            <CardDescription>Для этого места постов нет.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {items.map((p) => (
            <div
              key={p.id}
              ref={(el) => {
                postCardRefs.current[p.id] = el;
              }}
            >
              <FeedPostCard
                post={p}
                deleteMode={deleteMode}
                canDelete={canDelete}
                onDelete={handleDeletePost}
                onOpen={openExpanded}
                showPlaceInCard={showPlaceInCard}
                canLike={canLike}
                canComment={canComment}
                isCommentsOpen={commentsPostId === p.id}
                currentUserId={auth.user?.id ?? null}
                accessToken={auth.accessToken}
                onLikeToggled={updatePostLike}
                onLikeSuccess={() =>
                  queryClient.invalidateQueries({ queryKey: ["posts"] })
                }
                onOpenComments={openComments}
                onCommentAdded={() =>
                  queryClient.invalidateQueries({ queryKey: ["posts"] })
                }
              />
            </div>
          ))}

          <div ref={sentinelRef} className="col-span-full h-10" />

          {postsQuery.isFetchingNextPage ? (
            <p className="text-muted-foreground col-span-full text-center text-sm">
              Загружаю ещё…
            </p>
          ) : postsQuery.hasNextPage ? (
            <p className="text-muted-foreground col-span-full text-center text-sm">
              Прокрути ниже — подгружу ещё.
            </p>
          ) : (
            <p className="text-muted-foreground col-span-full text-center text-sm">
              Конец ленты.
            </p>
          )}
        </div>
      )}

      {expandedPost ? (
        <FeedExpandedModal
          post={expandedPost}
          onClose={closeExpanded}
          expandedVideoSrc={expandedVideoSrc}
          videoRef={videoRef}
          shouldAutoPlayRef={shouldAutoPlayRef}
          lastVideoTapRef={lastVideoTapRef}
        />
      ) : null}
    </main>
  );
}
