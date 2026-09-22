"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchAuthors, type ApiAuthor } from "@/shared/api/api";

export function useSelectedAuthor({ canonicalize = false }: { canonicalize?: boolean } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authorsQuery = useQuery({ queryKey: ["authors"], queryFn: fetchAuthors });
  const requestedId = searchParams.get("author");
  const authors = useMemo(() => authorsQuery.data?.items ?? [], [authorsQuery.data]);
  const author = useMemo<ApiAuthor | null>(() => {
    if (!authors.length) return null;
    return authors.find((item) => item.id === requestedId)
      ?? authors.find((item) => item.username.toLowerCase() === "tapir")
      ?? authors[0];
  }, [authors, requestedId]);

  useEffect(() => {
    if (!canonicalize || !author || requestedId === author.id) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("author", author.id);
    // An invalid author must not retain a country/city from another journal.
    if (requestedId) {
      next.delete("country");
      next.delete("city");
      next.set("all", "true");
    } else if (!next.has("all") && !next.has("country")) {
      next.set("all", "true");
    }
    router.replace(`/?${next.toString()}`);
  }, [author, canonicalize, requestedId, router, searchParams]);

  function selectAuthor(authorId: string) {
    if (!authors.some((item) => item.id === authorId) || authorId === author?.id) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("author", authorId);
    next.delete("country");
    next.delete("city");
    next.delete("delete");
    next.set("all", "true");
    router.push(`/?${next.toString()}`);
  }

  return {
    author,
    authors,
    authorsQuery,
    selectAuthor,
    isReady: Boolean(author && requestedId === author.id),
  };
}
