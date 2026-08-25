"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchPostsPage,
  fetchPlaces,
  deletePost,
  type ApiPost,
} from "@/shared/api/api";
import { useInView } from "@/shared/lib/hooks/use-in-view";
import { useAuth } from "@/entities/session/model/auth";
import { Card, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { FeedHeader } from "./feed-header";
import { FeedPostCard } from "./feed-post-card";
import { FeedExpandedModal } from "./feed-expanded-modal";
import { useFeedParams } from "../model/use-feed-params";
import { useFeedPermissions } from "../model/use-feed-permissions";
import { useExpandedModalBehavior } from "../model/use-expanded-modal-behavior";
import { FeedHero } from "./feed-hero";
import { MobileChapters } from "./mobile-chapters";
import { CitySelection } from "./city-selection";
import { buildPostsCountryCityFilter } from "../model/posts-query-params";

const POSTS_PAGE_LIMIT = 9;

export function Feed() {
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

  const placesQuery = useQuery({
    queryKey: ["places"],
    queryFn: fetchPlaces,
  });

  const selectedCountryPlace = useMemo(
    () =>
      placesQuery.data?.countries.find(
        (item) => item.country === selectedCountry,
      ),
    [placesQuery.data, selectedCountry],
  );

  const hasCountryOnlySelection = Boolean(
    selectedCountry && !selectedCity && !all,
  );

  const isCitySelection = Boolean(
    hasCountryOnlySelection &&
    selectedCountryPlace &&
    selectedCountryPlace.cities.length > 1,
  );

  const isCountryFeed = Boolean(
    hasCountryOnlySelection &&
    selectedCountryPlace &&
    selectedCountryPlace.cities.length === 0,
  );

  const canLoadPosts = Boolean(all || selectedCity || isCountryFeed);

  const postsQueryKey = useMemo(
    () => [
      "posts",
      {
        POSTS_PAGE_LIMIT,
        order,
        country: selectedCountry,
        city: selectedCity,
        all,
        accessToken: auth.accessToken ?? null,
      },
    ],
    [order, selectedCountry, selectedCity, all, auth.accessToken],
  );

  const postsQuery = useInfiniteQuery({
    queryKey: postsQueryKey,
    queryFn: ({ pageParam }) =>
      fetchPostsPage(
        {
          limit: POSTS_PAGE_LIMIT,
          cursor: typeof pageParam === "string" ? pageParam : undefined,
          order,
          ...buildPostsCountryCityFilter({
            all,
            selectedCountry,
            selectedCity,
            isCountryFeed,
          }),
        },
        auth.accessToken ?? undefined,
      ),
    enabled: Boolean(canLoadPosts && auth.hydrated),
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
        (
          old:
            | {
                pages: {
                  items: ApiPost[];
                  nextCursor: string | null;
                  hasMore: boolean;
                }[];
                pageParams: unknown[];
              }
            | undefined,
        ) => {
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

  const showPlaceInCard = Boolean(!all && !(selectedCountry && selectedCity));

  const openComments = useCallback(
    (postId: string) => {
      if (commentsPostId === postId) {
        setCommentsPostId(null);
        return;
      }
      const el = postCardRefs.current[postId];
      if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
      setTimeout(() => setCommentsPostId(postId), 380);
    },
    [commentsPostId],
  );

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

      {isCitySelection ? (
        <CitySelection
          selectedCountry={selectedCountry}
          places={placesQuery.data}
        />
      ) : null}

      {!canLoadPosts ? null : postsQuery.isLoading ? (
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
