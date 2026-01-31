"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Play, ArrowDownAZ, ArrowUpAZ, Trash2 } from "lucide-react";
import { fetchPostsPage, deletePost } from "@/shared/api/api";
import {
  cloudinaryThumbUrl,
  cloudinaryFullUrl,
  cloudinaryOptimizedUrl,
  cloudinaryVideoPosterUrl,
} from "@/shared/lib/cloudinary";
import { useInView } from "@/shared/lib/hooks/use-in-view";
import { useAuth } from "@/entities/session/model/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

export function Feed() {
  const limit = 30;
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const order: "asc" | "desc" = searchParams.get("order") === "desc" ? "desc" : "asc";
  const deleteMode = searchParams.get("delete") === "1";
  const canDelete = Boolean(
    auth.user && (auth.user.role === "ADMIN" || auth.user.role === "SUPERADMIN"),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollYRef = useRef(0);
  const lastVideoTapRef = useRef(0);

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

  function setOrder(next: "asc" | "desc") {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("order", next);
    router.push(`/?${nextParams.toString()}`);
  }

  async function handleDeletePost(postId: string) {
    if (!auth.accessToken || !canDelete) return;
    if (!confirm("Удалить пост? Файл будет удалён из Cloudinary и из ленты.")) return;
    try {
      await deletePost(auth.accessToken, postId);
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      await queryClient.invalidateQueries({ queryKey: ["places"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось удалить");
    }
  }

  return (
    <main className="mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{headerTitle}</h1>
        </div>
        {isSelectionReady ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Порядок:</span>
            <Button
              variant={order === "desc" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setOrder("desc")}
              aria-label="Сначала новые"
            >
              <ArrowDownAZ className="size-4" />
            </Button>
            <Button
              variant={order === "asc" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setOrder("asc")}
              aria-label="Сначала старые"
            >
              <ArrowUpAZ className="size-4" />
            </Button>
          </div>
        ) : null}
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
            <Card key={p.id} className="relative overflow-hidden">
              {deleteMode && canDelete ? (
                <button
                  type="button"
                  className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-red-600/90 text-white shadow hover:bg-red-600"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeletePost(p.id);
                  }}
                  aria-label="Удалить пост"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
              <CardContent className="space-y-3 pt-6">
                {p.media_type === "VIDEO" ? (
                  <button
                    type="button"
                    className="relative block w-full cursor-zoom-in"
                    onClick={() => setExpandedId(p.id)}
                    aria-label="Открыть видео"
                  >
                    {p.cloudinary_public_id ? (
                      <Image
                        className="h-auto w-full rounded-lg border"
                        alt={p.text ?? "travel video"}
                        src={
                          cloudinaryVideoPosterUrl(p.media_url, p.cloudinary_public_id, {
                            width: 600,
                          }) ?? cloudinaryThumbUrl(p.media_url, p.media_type)
                        }
                        width={720}
                        height={540}
                        sizes="(max-width: 768px) 100vw, 720px"
                        unoptimized
                      />
                    ) : (
                      <video
                        className="pointer-events-none w-full rounded-lg border"
                        playsInline
                        muted
                        preload="metadata"
                        src={cloudinaryOptimizedUrl(p.media_url, p.media_type)}
                      />
                    )}

                    {/* Video indicator */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30">
                        <Play className="ml-0.5 size-6 fill-white" />
                      </div>
                    </div>
                    <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white ring-1 ring-white/20">
                      VIDEO
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in"
                    onClick={() => setExpandedId(p.id)}
                  >
                    <Image
                      className="h-auto w-full rounded-lg border"
                      alt={p.text ?? "travel media"}
                      src={cloudinaryThumbUrl(p.media_url, p.media_type)}
                      width={720}
                      height={540}
                      sizes="(max-width: 768px) 100vw, 720px"
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
          <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center">
            {expandedPost.media_type === "VIDEO" ? (
              // For video, keep backdrop click-to-close, but don't close when interacting with controls.
              <div
                className="relative h-full w-full overflow-hidden rounded-lg"
                onClick={(e) => {
                  // Single taps should work for controls (play/pause/seek),
                  // but a "repeat tap" should close. We treat it as a double-tap.
                  const now = Date.now();
                  if (now - lastVideoTapRef.current < 300) {
                    setExpandedId(null);
                    return;
                  }
                  lastVideoTapRef.current = now;
                  e.stopPropagation();
                }}
              >
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
                          { width: 1200 },
                        ) ?? undefined
                      : undefined
                  }
                />
              </div>
            ) : (
              // For photo: tap again anywhere on the photo to close (no header/buttons).
              <button
                type="button"
                className="relative h-full w-full cursor-zoom-out overflow-hidden rounded-lg"
                onClick={() => setExpandedId(null)}
                aria-label="Закрыть"
              >
                <Image
                  alt={expandedPost.text ?? "travel media"}
                  src={cloudinaryFullUrl(expandedPost.media_url, expandedPost.media_type)}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  unoptimized
                  priority
                />
              </button>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

