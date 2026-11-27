"use client";

import { useEffect, useMemo } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { displayCountryName, usePlaces } from "@/entities/place";
import { AuthorSelector } from "@/entities/author";
import { useAuth } from "@/entities/session";
import {
  useJournalNavigation,
  useJournalSelectionState,
  MobileChapters,
  CitySelection,
  JournalFilters,
} from "@/features/journal-navigation";
import { PostMetadataDialog, PostDeleteDialog } from "@/features/manage-post";
import { MediaViewer, useMediaViewer } from "@/features/media-viewer";
import { FeedPostGrid, useFeedPosts } from "@/widgets/post-feed";
import { fetchAlbums, type ApiPost } from "@/shared/api/api";
import { useInView } from "@/shared/lib/hooks/use-in-view";
import { Card, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { useJournalPostActions } from "../model/use-journal-post-actions";
import { selectHeroPhoto } from "../model/hero-photo-selection";
import { selectFeedMediaStats } from "../model/journal-media-stats";
import { JournalAlbums } from "./journal-albums";
import { JournalCloudinaryConnection } from "./journal-cloudinary-connection";
import { FeedHero } from "./journal-hero";
import { FeedServerLoadingNotice } from "./journal-loading-notice";

const EMPTY_POSTS: ApiPost[] = [];

export function JournalPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const {
    order,
    setOrder,
    deleteMode,
    selectedCountry,
    selectedCity,
    selectedAlbumId,
    selectAlbum,
    all,
    headerTitle,
    isSelectionReady,
    author,
    authors,
    authorsQuery,
    selectAuthor,
    isAuthorReady,
  } = useJournalNavigation({ canonicalizeAuthor: true });
  const isOwnAuthorJournal =
    isAuthorReady && auth.user?.role === "AUTHOR" && auth.user.id === author?.id;
  const placesQuery = usePlaces(author?.id, isAuthorReady);

  const { selectedCountryPlace, isCountryFeed, canLoadPosts: canLoadPlacePosts } =
    useJournalSelectionState({
      places: placesQuery.data,
      selectedCountry,
      selectedCity,
      all,
    });
  const isAlbumView = Boolean(selectedAlbumId);
  const albumAuthorId =
    isAuthorReady && selectedCountry && (selectedCountryPlace || isAlbumView)
      ? author?.id
      : undefined;
  const albumsKey = ["albums", albumAuthorId, selectedCountry];
  const albumsQuery = useQuery({
    queryKey: albumsKey,
    queryFn: albumAuthorId
      ? ({ signal }) => fetchAlbums(albumAuthorId, selectedCountry, signal)
      : skipToken,
  });
  const albums = albumsQuery.data?.albums ?? [];
  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId);
  const canLoadPosts = isAlbumView ? Boolean(selectedAlbum) : canLoadPlacePosts;
  const albumTitle = selectedAlbum
    ? `${displayCountryName(selectedCountry)} → ${selectedAlbum.title}`
    : null;
  const albumFeedMessage = selectedAlbum
    ? "Пока нет записей"
    : albumsQuery.isError
      ? "Не удалось загрузить альбомы."
      : albumsQuery.isSuccess
        ? "Альбом не найден"
        : "Загружаем альбом…";
  const showCountryNavigation = Boolean(selectedCountryPlace || selectedAlbum);
  const canCreateAlbum =
    auth.user?.id === author?.id &&
    (auth.user?.role === "AUTHOR" ||
      auth.user?.role === "ADMIN" ||
      auth.user?.role === "SUPERADMIN");

  const { postsQueryKey, postsQuery, items: placePosts, loadMorePosts } = useFeedPosts({
    order,
    selectedCountry,
    selectedCity,
    all,
    isCountryFeed,
    authorId: author?.id,
    albumId: selectedAlbum?.id,
    accessToken: auth.accessToken,
    enabled: Boolean(canLoadPosts && auth.hydrated && isAuthorReady),
  });
  const items = isAlbumView && !selectedAlbum ? EMPTY_POSTS : placePosts;
  const {
    editingPost,
    setEditingPost,
    metadataSaving,
    saveMetadata,
    postActions,
    deletingPost,
    deleting,
    deleteError,
    confirmDeletePost,
    closeDeleteDialog,
    deleteNotice,
    clearDeleteNotice,
  } = useJournalPostActions({
    items,
    postsQueryKey,
    order,
    user: auth.user,
    accessToken: auth.accessToken,
  });
  const {
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = postsQuery;

  const viewer = useMediaViewer(items, {
    hasMore: canLoadPosts && Boolean(hasNextPage),
    loadMore: loadMorePosts,
    loadMoreFailed: isFetchNextPageError && !isFetchingNextPage,
  });

  const inViewOptions = useMemo(() => ({ rootMargin: "300px" }), []);
  const { ref: sentinelRef, inView } = useInView<HTMLDivElement>(inViewOptions);

  useEffect(() => {
    if (!canLoadPosts) return;
    if (viewer.expandedPost) return;
    if (!inView) return;
    if (!hasNextPage) return;
    if (isFetchingNextPage) return;
    if (isFetchNextPageError) return;
    void fetchNextPage();
  }, [
    canLoadPosts,
    viewer.expandedPost,
    inView,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  ]);

  const showPlaceInCard = Boolean(!all && !(selectedCountry && selectedCity));
  const showPosts = canLoadPosts && items.length > 0;
  const isInitialPostsLoading = Boolean(canLoadPosts && postsQuery.isLoading);
  const showAlbumStatus =
    isAlbumView && isAuthorReady &&
    (!selectedAlbum || (postsQuery.isSuccess && items.length === 0));
  const heroTitle =
    albumTitle ??
    (isSelectionReady && !all
      ? headerTitle.replace(" / ", ": ")
      : author?.username.toLowerCase() === "tapir"
        ? "Tapir Travel"
        : author?.name?.trim() || author?.username || "Travel");
  const heroPhoto =
    author?.username.toLowerCase() === "tapir"
      ? selectHeroPhoto({
          all,
          country: selectedCountry,
          city: selectedCity,
        })
      : null;
  const heroMediaStats = isAlbumView
    ? null
    : selectFeedMediaStats({
        places: placesQuery.data,
        all,
        selectedCountry,
        selectedCity,
      });

  return (
    <main className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 overflow-x-hidden px-4 py-3 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
      <div className="lg:hidden">
        <AuthorSelector
          authors={authors}
          selectedId={author?.id ?? null}
          onSelect={selectAuthor}
          compact
        />
      </div>
      {authorsQuery.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-300/20 bg-red-950/20 p-3 text-sm text-red-100"
        >
          Не удалось загрузить авторов. Обнови страницу и попробуй снова.
        </p>
      ) : null}
      {isOwnAuthorJournal && auth.accessToken ? (
        <JournalCloudinaryConnection
          key={auth.accessToken}
          accessToken={auth.accessToken}
        />
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

      <MobileChapters
        selectedCountry={selectedCountry}
        places={placesQuery.data}
        isLoading={placesQuery.isLoading}
      />

      {isAuthorReady && author && showCountryNavigation ? (
        <nav aria-label="Навигация по стране" className="grid gap-2.5">
          <CitySelection
            country={selectedCountry}
            cities={selectedCountryPlace?.cities ?? []}
            selectedCity={isAlbumView ? null : selectedCity}
          />
          <JournalAlbums
            key={`${author.id}:${selectedCountry}`}
            country={selectedCountry}
            accessToken={canCreateAlbum ? auth.accessToken : null}
            albums={albums}
            selectedAlbumId={selectedAlbumId}
            isPending={albumsQuery.isPending}
            isError={albumsQuery.isError}
            onSelect={(albumId) => selectAlbum(selectedCountry, albumId)}
            onCreated={() => {
              void queryClient.invalidateQueries({ queryKey: albumsKey, exact: true });
            }}
          />
        </nav>
      ) : null}

      <JournalFilters
        headerTitle={albumTitle ?? headerTitle}
        isSelectionReady={Boolean(isSelectionReady)}
        showCountryFilters={isAuthorReady && showCountryNavigation}
        order={order}
        onOrderChange={setOrder}
      />

      <FeedServerLoadingNotice
        isPlacesLoading={authorsQuery.isLoading || placesQuery.isLoading}
        isPostsLoading={isInitialPostsLoading}
      />

      {showAlbumStatus ? (
        <section aria-label="Лента альбома" className="min-h-dvh">
          <Card className="travel-glass border-white/10 bg-white/[0.055]">
            <CardHeader>
              <CardTitle aria-live="polite">{albumFeedMessage}</CardTitle>
            </CardHeader>
          </Card>
        </section>
      ) : null}

      {!canLoadPosts ? null : postsQuery.isLoading ? null : postsQuery.isError &&
        items.length === 0 ? (
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
      ) : !isAlbumView && items.length === 0 ? (
        <Card className="travel-glass border-white/10 bg-white/[0.055]">
          <CardHeader>
            <CardTitle className="text-white">Пока пусто</CardTitle>
            <CardDescription className="text-white/55">
              {all
                ? "У этого автора пока нет публикаций."
                : "Для этого места постов нет."}
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
        onOpen={viewer.openExpanded}
        onPhotoPreviewReady={viewer.rememberPhotoPreview}
      />
      {showPosts ? (
        <>
          <div ref={sentinelRef} className="h-10" />

          {postsQuery.isFetchingNextPage ? (
            <p className="text-center text-sm text-white/50">Загружаю ещё…</p>
          ) : isFetchNextPageError ? (
            <div
              className="flex flex-wrap items-center justify-center gap-3 text-center text-sm text-white/70"
              role="status"
            >
              <span>Не удалось загрузить следующие посты.</span>
              <button
                type="button"
                className="min-h-11 cursor-pointer rounded-lg px-3 text-[#83c8b6] outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#83c8b6]"
                onClick={() => {
                  void fetchNextPage({ cancelRefetch: false });
                }}
              >
                Повторить
              </button>
            </div>
          ) : postsQuery.hasNextPage ? (
            <p className="text-center text-sm text-white/50">
              Прокрути ниже — подгружу ещё.
            </p>
          ) : (
            <p className="text-center text-sm text-white/50">Конец ленты.</p>
          )}
        </>
      ) : null}
      {deleteNotice ? (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-[80] flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-xl border border-[#83c8b6]/40 bg-[#0b1517] py-2 pl-4 pr-2 text-sm text-amber-50 shadow-xl"
        >
          <span>{deleteNotice}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={clearDeleteNotice}
            aria-label="Скрыть уведомление"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}
      <PostDeleteDialog
        post={deletingPost}
        deleting={deleting}
        error={deleteError}
        onClose={closeDeleteDialog}
        onConfirm={confirmDeletePost}
      />
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
        saving={metadataSaving}
        variant={editingPost?.media_type === "STORY" ? "story" : "default"}
        requireFields={editingPost?.media_type === "STORY"}
        onOpenChange={(open) => {
          if (!open) setEditingPost(null);
        }}
        onSubmit={saveMetadata}
      />

      <MediaViewer viewer={viewer} />
    </main>
  );
}
