"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { fetchPostsPage } from "@/shared/api/api";
import { cloudinaryOptimizedUrl, cloudinaryVideoPosterUrl } from "@/shared/lib/cloudinary";
import { useInView } from "@/shared/lib/hooks/use-in-view";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

export function Feed() {
  const limit = 30;
  const order: "asc" | "desc" = "asc";
  const searchParams = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollYRef = useRef(0);

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

  const isSelectionReady = all || unknown || (selectedCountry && selectedCity);

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
      if (e.key === "Escape") setExpandedId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedId]);

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

  return (
    <main className="mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{headerTitle}</h1>
        </div>
      </header>

      {!isSelectionReady ? (
        <div className="hidden lg:block">
          <Card>
            <CardHeader>
              <CardTitle>Выбери место слева</CardTitle>
              <CardDescription>Страна → город. Или нажми “Все посты”.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      ) : null}

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
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="space-y-3 pt-6">
                {p.media_type === "VIDEO" ? (
                  <div className="space-y-2">
                    <video
                      className="w-full cursor-zoom-in rounded-lg border"
                      controls
                      playsInline
                      preload="metadata"
                      src={cloudinaryOptimizedUrl(p.media_url, p.media_type)}
                      poster={
                        p.cloudinary_public_id
                          ? cloudinaryVideoPosterUrl(p.media_url, p.cloudinary_public_id) ??
                            undefined
                          : undefined
                      }
                      onClick={() => setExpandedId(p.id)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in"
                    onClick={() => setExpandedId(p.id)}
                  >
                    <Image
                      className="h-auto w-full rounded-lg border"
                      alt={p.text ?? "travel media"}
                      src={cloudinaryOptimizedUrl(p.media_url, p.media_type)}
                      width={1600}
                      height={1200}
                      sizes="(max-width: 1024px) 100vw, (max-width: 1536px) 50vw, 33vw"
                      // Avoid Next Image optimizer 400s for some Cloudinary formats.
                      unoptimized
                    />
                  </button>
                )}

                {p.text ? <p className="text-sm leading-relaxed">{p.text}</p> : null}

                <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
                  <span>♥ {p.like_count}</span>
                  <span>💬 {p.comment_count}</span>
                  {p.lat != null && p.lng != null ? (
                    <span>
                      📍 {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                    </span>
                  ) : null}
                  {!unknown && !all && !(selectedCountry && selectedCity) ? (
                    <span>
                      {(p.country ?? "Unknown") + (p.city ? ` / ${p.city}` : "")}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}

          <div ref={sentinelRef} className="col-span-full h-10" />

          {postsQuery.isFetchingNextPage ? (
            <p className="text-muted-foreground col-span-full text-center text-sm">Загружаю ещё…</p>
          ) : postsQuery.hasNextPage ? (
            <p className="text-muted-foreground col-span-full text-center text-sm">
              Прокрути ниже — подгружу ещё.
            </p>
          ) : (
            <p className="text-muted-foreground col-span-full text-center text-sm">Конец ленты.</p>
          )}
        </div>
      )}

      {expandedPost ? (
        <div
          className="fixed inset-0 z-50 bg-black/90 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр медиа"
          onClick={() => setExpandedId(null)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 text-sm text-white/90">
                <div className="truncate">Просмотр</div>
                <div className="truncate text-white/60">Нажми ESC или “Закрыть”.</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setExpandedId(null)}>
                Закрыть
              </Button>
            </div>

            <div className="relative flex-1 overflow-hidden rounded-lg">
              {expandedPost.media_type === "VIDEO" ? (
                <video
                  className="h-full w-full bg-black object-contain"
                  controls
                  playsInline
                  preload="auto"
                  src={cloudinaryOptimizedUrl(expandedPost.media_url, expandedPost.media_type)}
                  poster={
                    expandedPost.cloudinary_public_id
                      ? cloudinaryVideoPosterUrl(
                          expandedPost.media_url,
                          expandedPost.cloudinary_public_id,
                        ) ?? undefined
                      : undefined
                  }
                />
              ) : (
                <Image
                  alt={expandedPost.text ?? "travel media"}
                  src={cloudinaryOptimizedUrl(expandedPost.media_url, expandedPost.media_type)}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  unoptimized
                  priority
                />
              )}
            </div>

            {expandedPost.text ? (
              <p className="line-clamp-3 text-sm leading-relaxed text-white/90">{expandedPost.text}</p>
            ) : null}

            <div className="flex flex-wrap gap-4 text-xs text-white/70">
              <span>♥ {expandedPost.like_count}</span>
              <span>💬 {expandedPost.comment_count}</span>
              {expandedPost.lat != null && expandedPost.lng != null ? (
                <span>
                  📍 {expandedPost.lat.toFixed(4)}, {expandedPost.lng.toFixed(4)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

