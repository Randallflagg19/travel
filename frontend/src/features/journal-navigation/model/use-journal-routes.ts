"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { buildJournalUrl, type JournalChange } from "./journal-url";

/** URL controls do not subscribe to or refetch the list of authors. */
export function useJournalRoutes() {
  const router = useRouter();
  const search = useSearchParams().toString();

  function navigate(change: JournalChange) {
    router.push(buildJournalUrl(search, change));
  }

  return {
    selectCountry: (country: string) => navigate({ type: "country", country }),
    selectCity: (country: string, city: string) => navigate({ type: "city", country, city }),
    selectAll: () => navigate({ type: "all" }),
    toggleDeleteMode: () => navigate({ type: "toggle-delete" }),
  };
}
