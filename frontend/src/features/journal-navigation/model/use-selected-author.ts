"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthors, type Author } from "@/entities/author";
import { buildJournalUrl } from "./journal-url";

export function useSelectedAuthor({
  canonicalize = false,
}: { canonicalize?: boolean } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authorsQuery = useAuthors();
  const requestedId = searchParams.get("author");
  const authors = useMemo(
    () => authorsQuery.data?.items ?? [],
    [authorsQuery.data],
  );
  const author = useMemo<Author | null>(() => {
    if (!authors.length) return null;
    return (
      authors.find((item) => item.id === requestedId) ??
      authors.find((item) => item.username.toLowerCase() === "tapir") ??
      authors[0]
    );
  }, [authors, requestedId]);

  useEffect(() => {
    if (!canonicalize || !author || requestedId === author.id) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("author", author.id);
    // An invalid author must not retain a country/city from another journal.
    if (requestedId) {
      next.delete("country");
      next.delete("city");
      next.delete("album");
      next.set("all", "true");
    } else if (!next.has("all") && !next.has("country")) {
      next.set("all", "true");
    }
    router.replace(`/?${next.toString()}`, { scroll: false });
  }, [author, canonicalize, requestedId, router, searchParams]);

  function selectAuthor(authorId: string) {
    if (
      !authors.some((item) => item.id === authorId) ||
      authorId === author?.id
    )
      return;
    router.push(
      buildJournalUrl(searchParams.toString(), { type: "author", authorId }),
      { scroll: false },
    );
  }

  return {
    author,
    authors,
    authorsQuery,
    selectAuthor,
    // The default author can load while its URL is being canonicalized.
    // An invalid author must still wait for its place filters to be cleared.
    isReady: Boolean(author && (!requestedId || requestedId === author.id)),
  };
}
