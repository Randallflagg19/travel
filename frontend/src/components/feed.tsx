"use client";

import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { fetchPostsPage } from "@/lib/api";
import { cloudinaryOptimizedUrl } from "@/lib/cloudinary";
import { useInView } from "@/hooks/use-in-view";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Feed() {
  const limit = 30;
  const order: "asc" | "desc" = "asc";
  const searchParams = useSearchParams();

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

  const inViewOptions = useMemo(() => ({ rootMargin: "600px" }), []);
  const { ref: sentinelRef, inView } = useInView<HTMLDivElement>(inViewOptions);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = postsQuery;

  useEffect(() => {
    if (!inView) return;
    if (!hasNextPage) return;
    if (isFetchingNextPage) return;
    void fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{headerTitle}</h1>
        </div>
      </header>

      {!isSelectionReady ? (
        <Card>
          <CardHeader>
            <CardTitle>Выбери место слева</CardTitle>
            <CardDescription>Страна → город. Или нажми “Все посты”.</CardDescription>
          </CardHeader>
        </Card>
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
        <div className="grid gap-4">
          {items.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="space-y-3 pt-6">
                {p.media_type === "VIDEO" ? (
                  <div className="space-y-2">
                    <video
                      className="w-full rounded-lg border"
                      controls
                      playsInline
                      preload="metadata"
                      src={cloudinaryOptimizedUrl(p.media_url, p.media_type)}
                    />
                    <a
                      className="text-muted-foreground text-xs underline underline-offset-4"
                      href={p.media_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Открыть видео в новой вкладке
                    </a>
                  </div>
                ) : (
                  <Image
                    className="h-auto w-full rounded-lg border"
                    alt={p.text ?? "travel media"}
                    src={cloudinaryOptimizedUrl(p.media_url, p.media_type)}
                    width={1600}
                    height={1200}
                    sizes="(max-width: 768px) 100vw, 768px"
                    // Avoid Next Image optimizer 400s for some Cloudinary formats.
                    unoptimized
                  />
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

          <div ref={sentinelRef} className="h-10" />

          {postsQuery.isFetchingNextPage ? (
            <p className="text-muted-foreground text-center text-sm">Загружаю ещё…</p>
          ) : postsQuery.hasNextPage ? (
            <p className="text-muted-foreground text-center text-sm">
              Прокрути ниже — подгружу ещё.
            </p>
          ) : (
            <p className="text-muted-foreground text-center text-sm">Конец ленты.</p>
          )}
        </div>
      )}
    </main>
  );
}

