"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchPostsPage,
  fetchPlaces,
  deletePost,
  updatePostMetadata,
  type ApiPost,
  type PostsPage,
} from "@/shared/api/api";
import { useInView } from "@/shared/lib/hooks/use-in-view";
import { useAuth } from "@/entities/session/model/auth";
import { Card, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { FeedHeader } from "./feed-header";
import { FeedPostCard } from "./feed-post-card";
import { FeedMasonryItem } from "./feed-masonry-item";
import { FeedExpandedModal } from "./feed-expanded-modal";
import { useFeedParams } from "../model/use-feed-params";
import { useFeedPermissions } from "../model/use-feed-permissions";
import { FeedHero } from "./feed-hero";
import { MobileChapters } from "./mobile-chapters";
import { CitySelection } from "./city-selection";
import { FeedServerLoadingNotice } from "./feed-server-loading-notice";
import { buildPostsCountryCityFilter } from "../model/posts-query-params";
import { useFeedSelectionState } from "../model/use-feed-selection-state";
import { useExpandedPostModal } from "../model/use-expanded-post-modal";
import { useOpenFeedComments } from "../model/use-open-feed-comments";
import { selectHeroPhoto } from "../model/hero-photo-selection";
import { PostMetadataDialog } from "@/features/posts/ui/post-metadata-dialog";

const POSTS_PAGE_LIMIT = 9;

type PostsInfiniteData = {
  pages: PostsPage[];
  pageParams: unknown[];
};

export function Feed() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [editingPost, setEditingPost] = useState<ApiPost | null>(null);
  const {
    order,
    setOrder,
    deleteMode,
    selectedCountry,
    selectedCity,
    all,
    headerTitle,
    isSelectionReady,
  } = useFeedParams();
  const permissions = useFeedPermissions(auth.user);

  const { canDelete, canLike, canComment } = permissions;

  const { commentsPostId, postCardRefs, openComments } = useOpenFeedComments();
  const placesQuery = useQuery({
    queryKey: ["places"],
    queryFn: fetchPlaces,
  });

  const { isCitySelection, isCountryFeed, canLoadPosts } =
    useFeedSelectionState({
      places: placesQuery.data,
      selectedCountry,
      selectedCity,
      all,
    });

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

  const updatePostsCache = useCallback(
    (update: (post: ApiPost) => ApiPost | null) => {
      queryClient.setQueryData<PostsInfiniteData>(postsQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.flatMap((post) => {
              const nextPost = update(post);
              return nextPost ? [nextPost] : [];
            }),
          })),
        };
      });
    },
    [postsQueryKey, queryClient],
  );

  const {
    expandedPost,
    expandedVideoSrc,
    videoRef,
    shouldAutoPlayRef,
    openExpanded,
    closeExpanded,
    moveExpanded,
    canMoveExpanded,
  } = useExpandedPostModal(items);

  const inViewOptions = useMemo(() => ({ rootMargin: "300px" }), []);
  const { ref: sentinelRef, inView } = useInView<HTMLDivElement>(inViewOptions);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = postsQuery;

  useEffect(() => {
    if (!inView) return;
    if (!hasNextPage) return;
    if (isFetchingNextPage) return;
    void fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleDeletePost = useCallback(async (postId: string) => {
    if (!auth.accessToken || !canDelete) return;
    if (!confirm("Удалить пост? Файл будет удалён из Cloudinary и из ленты."))
      return;
    const previousPosts = queryClient.getQueryData<PostsInfiniteData>(postsQueryKey);
    updatePostsCache((post) => (post.id === postId ? null : post));
    try {
      await deletePost(auth.accessToken, postId);
      await queryClient.invalidateQueries({ queryKey: ["places"] });
    } catch (e) {
      queryClient.setQueryData(postsQueryKey, previousPosts);
      alert(e instanceof Error ? e.message : "Не удалось удалить");
    }
  }, [auth.accessToken, canDelete, postsQueryKey, queryClient, updatePostsCache]);

  async function handleMetadataSave(value: { title: string; text: string }) {
    if (!editingPost || !auth.accessToken || !canDelete) return;
    const postId = editingPost.id;
    const previousPosts = queryClient.getQueryData<PostsInfiniteData>(postsQueryKey);
    updatePostsCache((post) =>
      post.id === postId
        ? { ...post, title: value.title || null, text: value.text || null }
        : post,
    );
    setEditingPost(null);
    try {
      const { post: savedPost } = await updatePostMetadata(auth.accessToken, postId, {
        title: value.title || null,
        text: value.text || null,
      });
      updatePostsCache((post) => (post.id === postId ? savedPost : post));
    } catch (error) {
      queryClient.setQueryData(postsQueryKey, previousPosts);
      console.error("updatePostMetadata failed", error);
      alert("Не удалось сохранить изменения. Попробуйте ещё раз.");
    }
  }

  const handleToggleFeatured = useCallback(async (post: ApiPost) => {
    if (!auth.accessToken || !canDelete) return;
    const layout = post.layout === "FEATURED" ? "STANDARD" : "FEATURED";
    const previousPosts = queryClient.getQueryData<PostsInfiniteData>(postsQueryKey);
    updatePostsCache((cachedPost) =>
      cachedPost.id === post.id ? { ...cachedPost, layout } : cachedPost,
    );
    try {
      const { post: savedPost } = await updatePostMetadata(auth.accessToken, post.id, {
        layout,
      });
      updatePostsCache((cachedPost) =>
        cachedPost.id === post.id ? savedPost : cachedPost,
      );
    } catch (error) {
      queryClient.setQueryData(postsQueryKey, previousPosts);
      console.error("update post layout failed", error);
      alert("Не удалось изменить размер карточки. Попробуйте ещё раз.");
    }
  }, [auth.accessToken, canDelete, postsQueryKey, queryClient, updatePostsCache]);

  const handleLikeSuccess = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
  }, [queryClient]);

  const handleCommentAdded = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
  }, [queryClient]);

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
  const isInitialPostsLoading = Boolean(canLoadPosts && postsQuery.isLoading);
  const heroTitle =
    isSelectionReady && !all
      ? headerTitle.replace(" / ", ": ")
      : "Tapir Travel";
  const heroPhoto = selectHeroPhoto({
    all,
    country: selectedCountry,
    city: selectedCity,
  });

  return (
    <main className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 overflow-x-hidden px-4 py-3 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
      <FeedHero
        title={heroTitle}
        photoSrc={heroPhoto?.src ?? null}
        photoAlt={heroPhoto?.alt}
        photoPosition={heroPhoto?.position}
      />

      <FeedServerLoadingNotice
        isPlacesLoading={placesQuery.isLoading}
        isPostsLoading={isInitialPostsLoading}
      />

      <MobileChapters
        selectedCountry={selectedCountry}
        selectedCity={selectedCity}
        places={placesQuery.data}
        isLoading={placesQuery.isLoading}
        order={order}
        onOrderChange={setOrder}
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

      {!canLoadPosts ? null : postsQuery.isLoading ? null : postsQuery.isError ? (
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
        <div className="columns-2 gap-2.5 lg:columns-3 lg:gap-4">
          {items.map((p) => (
            <FeedMasonryItem
              key={p.id}
              featured={p.layout === "FEATURED"}
              onElement={(el) => {
                postCardRefs.current[p.id] = el;
              }}
            >
              <FeedPostCard
                post={p}
                deleteMode={deleteMode}
                canDelete={canDelete}
                canEdit={canDelete}
                onDelete={handleDeletePost}
                onEdit={setEditingPost}
                onToggleFeatured={handleToggleFeatured}
                onOpen={openExpanded}
                showPlaceInCard={showPlaceInCard}
                canLike={canLike}
                canComment={canComment}
                isCommentsOpen={commentsPostId === p.id}
                currentUserId={auth.user?.id ?? null}
                accessToken={auth.accessToken}
                onLikeToggled={updatePostLike}
                onLikeSuccess={handleLikeSuccess}
                onOpenComments={openComments}
                onCommentAdded={handleCommentAdded}
              />
            </FeedMasonryItem>
          ))}

          <div ref={sentinelRef} className="[column-span:all] h-10" />

          {postsQuery.isFetchingNextPage ? (
            <p className="[column-span:all] text-center text-sm text-white/50">
              Загружаю ещё…
            </p>
          ) : postsQuery.hasNextPage ? (
            <p className="[column-span:all] text-center text-sm text-white/50">
              Прокрути ниже — подгружу ещё.
            </p>
          ) : (
            <p className="[column-span:all] text-center text-sm text-white/50">
              Конец ленты.
            </p>
          )}
        </div>
      )}
      <PostMetadataDialog
        open={editingPost !== null}
        initialValue={{
          title: editingPost?.title ?? "",
          text: editingPost?.text ?? "",
        }}
        title={
          editingPost?.media_type === "STORY"
            ? "Редактировать историю"
            : "Редактировать запись"
        }
        submitLabel="Сохранить"
        variant={editingPost?.media_type === "STORY" ? "story" : "default"}
        requireFields={editingPost?.media_type === "STORY"}
        onOpenChange={(open) => {
          if (!open) setEditingPost(null);
        }}
        onSubmit={handleMetadataSave}
      />

      {expandedPost ? (
        <FeedExpandedModal
          post={expandedPost}
          onClose={closeExpanded}
          expandedVideoSrc={expandedVideoSrc}
          videoRef={videoRef}
          shouldAutoPlayRef={shouldAutoPlayRef}
          onMove={moveExpanded}
          canMove={canMoveExpanded}
        />
      ) : null}
    </main>
  );
}
