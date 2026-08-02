"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPostsPage,
  fetchPlaces,
  deletePost,
  type ApiPost,
  type PlacesResponse,
} from "@/shared/api/api";
import { useInView } from "@/shared/lib/hooks/use-in-view";
import { useAuth } from "@/entities/session/model/auth";
import { Card, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { FeedHeader, FeedEmptyState } from "./feed-header";
import { FeedPostCard } from "./feed-post-card";
import { FeedExpandedModal } from "./feed-expanded-modal";
import { useFeedParams } from "../model/use-feed-params";
import { useFeedPermissions } from "../model/use-feed-permissions";
import { useExpandedModalBehavior } from "../model/use-expanded-modal-behavior";
import { displayCountryName } from "@/features/places/model/place-labels";

type MobileChapter = {
  country: string;
  city: string;
  label: string;
  count: number;
  emoji: string;
};

function chapterEmoji(label: string) {
  if (label === "Bali") return "🌊";
  if (label === "Thailand") return "🏯";
  if (label === "China") return "🐉";
  if (label === "Egypt") return "𓂀";
  return "✈️";
}

function buildMobileChapters(data?: PlacesResponse): MobileChapter[] {
  return (
    data?.countries
      .map((country) => {
        const firstCity = country.cities[0]?.city;
        if (!firstCity) return null;
        const label = displayCountryName(country.country);
        return {
          country: country.country,
          city: firstCity,
          label,
          count: country.count,
          emoji: chapterEmoji(label),
        };
      })
      .filter((chapter): chapter is MobileChapter => Boolean(chapter)) ?? []
  );
}

function FeedHero({
  title,
  city,
  postsCount,
  isSelectionReady,
}: {
  title: string;
  city: string;
  postsCount: number;
  isSelectionReady: boolean;
}) {
  return (
    <>
      <section className="lg:hidden">
        <div className="travel-card-glow relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/10 bg-[#071014]">
          <Image
            src="/me.png"
            alt="Tapir Travel"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,10,14,0.04)_0%,rgba(5,10,14,0.1)_48%,rgba(5,10,14,0.36)_100%)]" />
        </div>

        <div className="travel-card-glow relative z-10 -mt-12 rounded-[1.7rem] border border-white/10 bg-[#071014]/88 p-6 backdrop-blur-xl">
          <p className="font-serif text-xl italic text-amber-200/88">
            личный журнал дороги
          </p>
          <h1 className="mt-2 font-serif text-5xl font-semibold italic leading-none tracking-tight text-amber-100">
            {title}
          </h1>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-white/72">
            Не отчёт. Просто места и детали, которые хочется помнить.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.22em] text-emerald-200/72">
            <span>
              {postsCount ? `${postsCount} кадров` : "выбери главу"}
            </span>
            {city ? <span>· {city}</span> : null}
            {!city && !isSelectionReady ? <span>· маршрут 2026</span> : null}
          </div>
        </div>
      </section>

      <section className="travel-card-glow relative hidden overflow-hidden rounded-[2rem] border border-white/10 bg-[#071014] lg:block">
      <div className="absolute inset-y-0 right-0 hidden w-[58%] overflow-hidden lg:block">
        <Image
          src="/me.png"
          alt="Tapir Travel"
          fill
          priority
          className="object-cover object-center opacity-88"
          sizes="58vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,16,20,0.92)_0%,rgba(7,16,20,0.2)_34%,rgba(7,16,20,0.18)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_18%,rgba(245,166,76,0.18),transparent_30%)]" />
      </div>
      <Image
        src="/me.png"
        alt="Tapir Travel"
        fill
        priority
        className="object-cover object-center opacity-35 lg:hidden"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,14,0.98)_0%,rgba(5,10,14,0.9)_42%,rgba(5,10,14,0.3)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(48,196,143,0.22),transparent_34%),radial-gradient(circle_at_84%_30%,rgba(245,166,76,0.16),transparent_30%)]" />

      <div className="relative flex min-h-[330px] items-center px-6 py-10 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="mb-4 font-serif text-2xl italic text-amber-200/90">
            личный журнал дороги
          </p>
          <h1 className="font-serif text-5xl font-semibold italic tracking-tight text-amber-100 sm:text-6xl lg:text-7xl xl:text-8xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
            Не отчёт и не витрина. Просто места, где я был, странные детали,
            случайные находки и фотографии, которые потом внезапно оказываются
            важнее, чем казались.
          </p>
          {!isSelectionReady ? (
            <p className="mt-5 text-sm font-medium uppercase tracking-[0.26em] text-emerald-200/70">
              выбери главу слева или открой все посты
            </p>
          ) : postsCount ? (
            <p className="mt-5 text-sm font-medium uppercase tracking-[0.26em] text-emerald-200/70">
              {postsCount} кадров сейчас в ленте
            </p>
          ) : city ? (
            <p className="mt-5 text-sm font-medium uppercase tracking-[0.26em] text-emerald-200/70">
              {city}
            </p>
          ) : null}
        </div>
      </div>
      </section>
    </>
  );
}

function MobileChapters({
  selectedCountry,
  places,
}: {
  selectedCountry: string;
  places?: PlacesResponse;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chapters = useMemo(() => buildMobileChapters(places), [places]);

  if (chapters.length === 0) return null;

  function selectChapter(chapter: MobileChapter) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("all");
    next.delete("unknown");
    next.set("country", chapter.country);
    next.set("city", chapter.city);
    router.push(`/?${next.toString()}`);
  }

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:hidden [&::-webkit-scrollbar]:hidden">
      {chapters.map((chapter) => {
        const active = selectedCountry === chapter.country;
        return (
          <button
            key={`${chapter.country}/${chapter.city}`}
            type="button"
            onClick={() => selectChapter(chapter)}
            className={`relative h-24 min-w-32 overflow-hidden rounded-3xl border p-3 text-left transition ${
              active
                ? "border-emerald-300/70 bg-emerald-300/14 shadow-lg shadow-emerald-950/30"
                : "border-white/10 bg-white/[0.055]"
            }`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,166,76,0.18),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01))]" />
            <div className="relative flex h-full flex-col justify-between">
              <span className="text-2xl">{chapter.emoji}</span>
              <span>
                <span className="block font-serif text-xl italic leading-none text-amber-100">
                  {chapter.label}
                </span>
                <span className="mt-1 block text-xs text-white/45">
                  {chapter.count} кадров
                </span>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function Feed() {
  const limit = 9;
  const queryClient = useQueryClient();
  const auth = useAuth();
  const feedParams = useFeedParams();
  const permissions = useFeedPermissions(auth.user);

  const {
    order,
    setOrder,
    deleteMode,
    selectedCountry,
    selectedCity,
    unknown,
    all,
    headerTitle,
    isSelectionReady,
  } = feedParams;

  const { canDelete, canLike, canComment } = permissions;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedVideoSrc, setExpandedVideoSrc] = useState<string | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const postCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastVideoTapRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldAutoPlayRef = useRef(false);

  const postsQueryKey = useMemo(
    () => [
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
    [
      limit,
      order,
      selectedCountry,
      selectedCity,
      unknown,
      all,
      auth.accessToken,
    ],
  );

  const postsQuery = useInfiniteQuery({
    queryKey: postsQueryKey,
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

  const placesQuery = useQuery({
    queryKey: ["places"],
    queryFn: fetchPlaces,
  });

  const items = useMemo(
    () => postsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [postsQuery.data],
  );

  const expandedPost = useMemo(() => {
    if (!expandedId) return null;
    return items.find((p) => p.id === expandedId) ?? null;
  }, [expandedId, items]);

  const inViewOptions = useMemo(() => ({ rootMargin: "300px" }), []);
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

  useExpandedModalBehavior(Boolean(expandedId), closeExpanded);

  useEffect(() => {
    if (!inView) return;
    if (!hasNextPage) return;
    if (isFetchingNextPage) return;
    void fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  const updatePostLike = useCallback(
    (postId: string, liked: boolean, deltaCount: number) => {
      queryClient.setQueryData(
        postsQueryKey,
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
    [queryClient, postsQueryKey],
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
    <main className="mx-auto flex w-full max-w-[1720px] flex-col gap-5 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
      <FeedHero
        title={headerTitle}
        city={selectedCity}
        postsCount={items.length}
        isSelectionReady={Boolean(isSelectionReady)}
      />

      <MobileChapters
        selectedCountry={selectedCountry}
        places={placesQuery.data}
      />

      <FeedHeader
        headerTitle={headerTitle}
        isSelectionReady={Boolean(isSelectionReady)}
        order={order}
        onOrderChange={setOrder}
      />

      <FeedEmptyState isSelectionReady={Boolean(isSelectionReady)} />

      {!isSelectionReady ? null : postsQuery.isLoading ? (
        <Card className="travel-glass border-white/10 bg-white/[0.055]">
          <CardHeader>
            <CardTitle className="text-white">Загрузка…</CardTitle>
            <CardDescription className="text-white/55">
              Тянем первую страницу постов.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : postsQuery.isError ? (
        <Card className="travel-glass border-white/10 bg-white/[0.055]">
          <CardHeader>
            <CardTitle className="text-white">Ошибка</CardTitle>
            <CardDescription className="text-white/55">
              {postsQuery.error instanceof Error
                ? postsQuery.error.message
                : "Не удалось загрузить посты"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : items.length === 0 ? (
        <Card className="travel-glass border-white/10 bg-white/[0.055]">
          <CardHeader>
            <CardTitle className="text-white">Пока пусто</CardTitle>
            <CardDescription className="text-white/55">
              Для этого места постов нет.
            </CardDescription>
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
            <p className="col-span-full text-center text-sm text-white/50">
              Загружаю ещё…
            </p>
          ) : postsQuery.hasNextPage ? (
            <p className="col-span-full text-center text-sm text-white/50">
              Прокрути ниже — подгружу ещё.
            </p>
          ) : (
            <p className="col-span-full text-center text-sm text-white/50">
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
