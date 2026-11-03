"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPlaces } from "@/shared/api/api";
import { useInView } from "@/shared/lib/hooks/use-in-view";
import { useAuth } from "@/entities/session/model/auth";
import { Card, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { PostMetadataDialog } from "@/features/posts/ui/post-metadata-dialog";
import { useFeedParams } from "../model/use-feed-params";
import { useFeedPosts } from "../model/use-feed-posts";
import { useFeedPostActions } from "../model/use-feed-post-actions";
import { useSelectedAuthor } from "../model/use-selected-author";
import { useFeedSelectionState } from "../model/use-feed-selection-state";
import { useExpandedPostModal } from "../model/use-expanded-post-modal";
import { selectHeroPhoto } from "../model/hero-photo-selection";
import { selectFeedMediaStats } from "../model/feed-media-stats";
import { FeedHeader } from "./feed-header";
import { FeedPostGrid } from "./feed-post-grid";
import { FeedExpandedModal } from "./feed-expanded-modal";
import { AuthorSelector } from "./author-selector";
import { FeedHero } from "./feed-hero";
import { MobileChapters } from "./mobile-chapters";
import { CitySelection } from "./city-selection";
import { FeedServerLoadingNotice } from "./feed-server-loading-notice";

export function Feed() {
  const auth = useAuth();
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
  const { author, authors, authorsQuery, selectAuthor, isReady: isAuthorReady } = useSelectedAuthor({ canonicalize: true });

  const placesQuery = useQuery({
    queryKey: ["places", author?.id],
    queryFn: () => fetchPlaces(author?.id),
    enabled: isAuthorReady,
  });

  const { isCitySelection, isCountryFeed, canLoadPosts } =
    useFeedSelectionState({
      places: placesQuery.data,
      selectedCountry,
      selectedCity,
      all,
    });

  const { postsQueryKey, postsQuery, items, loadMorePosts } = useFeedPosts({
    order, selectedCountry, selectedCity, all, isCountryFeed,
    authorId: author?.id,
    accessToken: auth.accessToken,
    enabled: Boolean(canLoadPosts && auth.hydrated && isAuthorReady),
  });
  const { editingPost, setEditingPost, saveMetadata, postActions } = useFeedPostActions({
    items, postsQueryKey, order, user: auth.user, accessToken: auth.accessToken,
  });
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = postsQuery;

  const {
    expandedPost,
    expandedVideoSrc,
    expandedPreviewSrc,
    rememberPhotoPreview,
    adjacentMedia,
    videoRef,
    shouldAutoPlayRef,
    openExpanded,
    closeExpanded,
    moveExpanded,
    cancelPendingNavigation,
    canMoveBackward,
    canMoveForward,
    navigationStatus,
    retryLoadMore,
  } = useExpandedPostModal(items, {
    hasMore: Boolean(hasNextPage),
    loadMore: loadMorePosts,
    loadMoreFailed: isFetchNextPageError && !isFetchingNextPage,
  });

  const inViewOptions = useMemo(() => ({ rootMargin: "300px" }), []);
  const { ref: sentinelRef, inView } = useInView<HTMLDivElement>(inViewOptions);

  useEffect(() => {
    if (expandedPost) return;
    if (!inView) return;
    if (!hasNextPage) return;
    if (isFetchingNextPage) return;
    if (isFetchNextPageError) return;
    void fetchNextPage();
  }, [expandedPost, inView, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const showPlaceInCard = Boolean(!all && !(selectedCountry && selectedCity));
  const showPosts = canLoadPosts && items.length > 0;
  const isInitialPostsLoading = Boolean(canLoadPosts && postsQuery.isLoading);
  const heroTitle =
    isSelectionReady && !all
      ? headerTitle.replace(" / ", ": ")
      : author?.username.toLowerCase() === "tapir"
        ? "Tapir Travel"
        : author?.name?.trim() || author?.username || "Travel";
  const heroPhoto = author?.username.toLowerCase() === "tapir"
    ? selectHeroPhoto({
        all,
        country: selectedCountry,
        city: selectedCity,
      })
    : null;
  const heroMediaStats = selectFeedMediaStats({
    places: placesQuery.data,
    all,
    selectedCountry,
    selectedCity,
  });

  return (
    <main className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 overflow-x-hidden px-4 py-3 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
      <div className="lg:hidden">
        <AuthorSelector authors={authors} selectedId={author?.id ?? null} onSelect={selectAuthor} compact />
      </div>
      {authorsQuery.isError ? (
        <p role="alert" className="rounded-xl border border-red-300/20 bg-red-950/20 p-3 text-sm text-red-100">
          Не удалось загрузить авторов. Обнови страницу и попробуй снова.
        </p>
      ) : null}
      <FeedHero
        title={heroTitle}
        photosCount={heroMediaStats?.photos ?? null}
        videosCount={heroMediaStats?.videos ?? null}
        photoSrc={heroPhoto?.src ?? null}
        photoAlt={heroPhoto?.alt}
        photoPosition={heroPhoto?.position}
        photoUnoptimized={heroPhoto?.unoptimized}
      />

      <FeedServerLoadingNotice
        isPlacesLoading={authorsQuery.isLoading || placesQuery.isLoading}
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

      {!canLoadPosts ? null : postsQuery.isLoading ? null : postsQuery.isError && items.length === 0 ? (
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
              {all ? "У этого автора пока нет публикаций." : "Для этого места постов нет."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
      <FeedPostGrid
        visible={showPosts}
        items={items}
        deleteMode={deleteMode}
        showPlaceInCard={showPlaceInCard}
        user={auth.user}
        accessToken={auth.accessToken}
        actions={postActions}
        onOpen={openExpanded}
        onPhotoPreviewReady={rememberPhotoPreview}
      />
      {showPosts ? (
        <>
          <div ref={sentinelRef} className="h-10" />

          {postsQuery.isFetchingNextPage ? (
            <p className="text-center text-sm text-white/50">
              Загружаю ещё…
            </p>
          ) : isFetchNextPageError ? (
            <div className="flex flex-wrap items-center justify-center gap-3 text-center text-sm text-white/70" role="status">
              <span>Не удалось загрузить следующие посты.</span>
              <button
                type="button"
                className="min-h-11 cursor-pointer rounded-lg px-3 text-[#83c8b6] outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#83c8b6]"
                onClick={() => { void fetchNextPage({ cancelRefetch: false }); }}
              >
                Повторить
              </button>
            </div>
          ) : postsQuery.hasNextPage ? (
            <p className="text-center text-sm text-white/50">
              Прокрути ниже — подгружу ещё.
            </p>
          ) : (
            <p className="text-center text-sm text-white/50">
              Конец ленты.
            </p>
          )}
        </>
      ) : null}
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
        onSubmit={saveMetadata}
      />

      {expandedPost ? (
        <FeedExpandedModal
          post={expandedPost}
          onClose={closeExpanded}
          expandedVideoSrc={expandedVideoSrc}
          previewSrc={expandedPreviewSrc}
          adjacentMedia={adjacentMedia}
          videoRef={videoRef}
          shouldAutoPlayRef={shouldAutoPlayRef}
          onMove={moveExpanded}
          onCancelPendingNavigation={cancelPendingNavigation}
          canMoveBackward={canMoveBackward}
          canMoveForward={canMoveForward}
          navigationStatus={navigationStatus}
          onRetryLoadMore={retryLoadMore}
        />
      ) : null}
    </main>
  );
}
