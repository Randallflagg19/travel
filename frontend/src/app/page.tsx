"use client";

import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPostsPage } from "@/lib/api";
import { cloudinaryOptimizedUrl } from "@/lib/cloudinary";
import { useInView } from "@/hooks/use-in-view";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  const limit = 30;

  const postsQuery = useInfiniteQuery({
    queryKey: ["posts", { limit }],
    queryFn: ({ pageParam }) =>
      fetchPostsPage({
        limit,
        cursor: typeof pageParam === "string" ? pageParam : undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
  });

  const items = useMemo(
    () => postsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [postsQuery.data],
  );

  const { ref: sentinelRef, inView } = useInView<HTMLDivElement>({
    rootMargin: "600px",
  });

  useEffect(() => {
    if (!inView) return;
    if (!postsQuery.hasNextPage) return;
    if (postsQuery.isFetchingNextPage) return;
    void postsQuery.fetchNextPage();
  }, [
    inView,
    postsQuery.hasNextPage,
    postsQuery.isFetchingNextPage,
    postsQuery.fetchNextPage,
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My Travels</h1>
          <p className="text-muted-foreground text-sm">
            Лента медиа из Cloudinary + посты из бэкенда.
          </p>
        </div>
      </header>

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
            <CardDescription>Нет постов в базе.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardHeader className="gap-1">
                <CardTitle className="text-base">
                  {(p.country ?? "—") + (p.city ? ` / ${p.city}` : "")}
                </CardTitle>
                <CardDescription>
                  {new Date(p.created_at).toLocaleString()}
                  {p.folder ? ` · ${p.folder}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {p.media_type === "VIDEO" ? (
                  <div className="space-y-2">
                    <video
                      className="w-full rounded-lg border"
                      controls
                      playsInline
                      preload="metadata"
                      // Use original URL (no transforms) to avoid Cloudinary 423 on large MOV files.
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
                  <img
                    className="w-full rounded-lg border"
                    alt={p.text ?? "travel media"}
                    loading="lazy"
                    src={cloudinaryOptimizedUrl(p.media_url, p.media_type)}
                  />
                )}

                {p.text ? <p className="text-sm leading-relaxed">{p.text}</p> : null}

                <div className="text-muted-foreground flex gap-4 text-xs">
                  <span>♥ {p.like_count}</span>
                  <span>💬 {p.comment_count}</span>
                  {p.lat != null && p.lng != null ? (
                    <span>
                      📍 {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}

          <div ref={sentinelRef} className="h-10" />

          {postsQuery.isFetchingNextPage ? (
            <p className="text-muted-foreground text-center text-sm">
              Загружаю ещё…
            </p>
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
