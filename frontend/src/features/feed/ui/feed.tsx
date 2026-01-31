"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchPostsPage, deletePost } from "@/shared/api/api";
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
      },
    ],
    queryFn: ({ pageParam }) =>
      fetchPostsPage({
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
      }),
    enabled: Boolean(isSelectionReady),
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

  const openExpanded = useCallback((id: string) => {
    setExpandedId(id);
    setExpandedVideoSrc(null);
    shouldAutoPlayRef.current = false;
  }, []);

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

  const showPlaceInCard = Boolean(
    !unknown && !all && !(selectedCountry && selectedCity),
  );

  return (
    <main className="mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-10">
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
            <FeedPostCard
              key={p.id}
              post={p}
              deleteMode={deleteMode}
              canDelete={canDelete}
              onDelete={handleDeletePost}
              onOpen={openExpanded}
              showPlaceInCard={showPlaceInCard}
            />
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
          onSetExpandedVideoSrc={setExpandedVideoSrc}
          videoRef={videoRef}
          shouldAutoPlayRef={shouldAutoPlayRef}
          lastVideoTapRef={lastVideoTapRef}
        />
      ) : null}
    </main>
  );
}
