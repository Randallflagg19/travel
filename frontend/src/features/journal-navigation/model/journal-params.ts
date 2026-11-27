"use client";

import { useCallback } from "react";
import { buildJournalUrl } from "./journal-url";
import { useRouter, useSearchParams } from "next/navigation";
import { readPlaceSelection } from "./place-selection";
import { displayCountryName, displayPlaceTitle } from "@/entities/place";

export type JournalOrder = "asc" | "desc";

export type JournalParams = {
  order: JournalOrder;
  setOrder: (next: JournalOrder) => void;
  deleteMode: boolean;
  selectedCountry: string;
  selectedCity: string;
  selectedAlbumId: string;
  all: boolean;
  headerTitle: string;
  isSelectionReady: boolean;
};

export function useJournalParams(): JournalParams {
  const router = useRouter();
  const searchParams = useSearchParams();

  const order: JournalOrder =
    searchParams.get("order") === "asc" ? "asc" : "desc";
  const deleteMode = searchParams.get("delete") === "1";
  const { selectedCountry, selectedCity: city, all } =
    readPlaceSelection(searchParams);
  const selectedAlbumId = selectedCountry ? (searchParams.get("album") ?? "") : "";
  const selectedCity = selectedAlbumId ? "" : city;

  const headerTitle = all
    ? "Все посты"
    : selectedCountry && selectedCity
      ? displayPlaceTitle(selectedCountry, selectedCity)
      : selectedCountry
        ? displayCountryName(selectedCountry)
        : "Tapir Travel";

  const isSelectionReady = Boolean(all || selectedCountry);

  const setOrder = useCallback(
    (next: JournalOrder) => {
      router.push(
        buildJournalUrl(searchParams.toString(), {
          type: "order",
          order: next,
        }),
        { scroll: false },
      );
    },
    [router, searchParams],
  );

  return {
    order,
    setOrder,
    deleteMode,
    selectedCountry,
    selectedCity,
    selectedAlbumId,
    all,
    headerTitle,
    isSelectionReady,
  };
}
