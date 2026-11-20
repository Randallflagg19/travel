"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useJournalParams } from "./journal-params";
import { useSelectedAuthor } from "./use-selected-author";
import { buildJournalUrl } from "./journal-url";
import { useJournalRoutes } from "./use-journal-routes";

export function useJournalNavigation({
  canonicalizeAuthor = false,
}: { canonicalizeAuthor?: boolean } = {}) {
  const router = useRouter();
  const search = useSearchParams().toString();
  const params = useJournalParams();
  const routes = useJournalRoutes();
  const selected = useSelectedAuthor({ canonicalize: canonicalizeAuthor });
  const homeHref = buildJournalUrl(search, {
    type: "home",
    authorId: selected.author?.id,
  });

  return {
    ...params,
    author: selected.author,
    authors: selected.authors,
    authorsQuery: selected.authorsQuery,
    isAuthorReady: selected.isReady,
    selectAuthor: selected.selectAuthor,
    ...routes,
    selectHome: () => router.push(homeHref),
    homeHref,
  };
}
