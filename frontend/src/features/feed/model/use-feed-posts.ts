import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPostsPage, type PostsPage } from "@/shared/api/api";
import type { FeedOrder } from "./use-feed-params";
import { buildPostsCountryCityFilter } from "./posts-query-params";

const POSTS_PAGE_LIMIT = 9;

export type PostsInfiniteData = {
  pages: PostsPage[];
  pageParams: unknown[];
};

type FeedPostsOptions = {
  order: FeedOrder;
  selectedCountry: string;
  selectedCity: string;
  all: boolean;
  isCountryFeed: boolean;
  authorId?: string;
  accessToken: string | null;
  enabled: boolean;
};

export function useFeedPosts({
  order, selectedCountry, selectedCity, all, isCountryFeed, authorId, accessToken, enabled,
}: FeedPostsOptions) {
  const queryClient = useQueryClient();
  const postsQueryKey = useMemo(
    () => [
      "posts",
      {
        POSTS_PAGE_LIMIT,
        order,
        country: selectedCountry,
        city: selectedCity,
        all,
        authorId,
        accessToken,
      },
    ],
    [order, selectedCountry, selectedCity, all, authorId, accessToken],
  );

  const postsQuery = useInfiniteQuery({
    queryKey: postsQueryKey,
    queryFn: ({ pageParam }) =>
      fetchPostsPage(
        {
          limit: POSTS_PAGE_LIMIT,
          cursor: typeof pageParam === "string" ? pageParam : undefined,
          order,
          authorId,
          ...buildPostsCountryCityFilter({
            all,
            selectedCountry,
            selectedCity,
            isCountryFeed,
          }),
        },
        accessToken ?? undefined,
      ),
    enabled,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
  });

  const items = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [postsQuery.data],
  );

  const { fetchNextPage } = postsQuery;
  const loadMorePosts = useCallback(async () => {
    const result = await fetchNextPage({ cancelRefetch: false });
    if (result.isFetchNextPageError) throw result.error;
    const pages = queryClient.getQueryData<PostsInfiniteData>(postsQueryKey)?.pages ?? [];
    const lastPage = pages.at(-1);
    return {
      items: pages.flatMap((page) => page.items),
      hasMore: Boolean(lastPage?.hasMore && lastPage.nextCursor),
      nextCursor: lastPage?.nextCursor ?? null,
    };
  }, [fetchNextPage, postsQueryKey, queryClient]);

  return { postsQueryKey, postsQuery, items, loadMorePosts };
}
