"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  displayCountryName,
  displayPlaceTitle,
} from "@/features/places/model/place-labels";

export type FeedOrder = "asc" | "desc";

export type FeedParams = {
  order: FeedOrder;
  setOrder: (next: FeedOrder) => void;
  deleteMode: boolean;
  selectedCountry: string;
  selectedCity: string;
  all: boolean;
  headerTitle: string;
  isSelectionReady: boolean;
};

export function useFeedParams(): FeedParams {
  const router = useRouter();
  const searchParams = useSearchParams();

  const order: FeedOrder =
    searchParams.get("order") === "asc" ? "asc" : "desc";
  const deleteMode = searchParams.get("delete") === "1";
  const selectedCountry = searchParams.get("country") ?? "";
  const selectedCity = searchParams.get("city") ?? "";
  const all = searchParams.get("all") === "true";

  const headerTitle = all
    ? "Все посты"
    : selectedCountry && selectedCity
      ? displayPlaceTitle(selectedCountry, selectedCity)
      : selectedCountry
        ? displayCountryName(selectedCountry)
        : "Tapir Travel";

  const isSelectionReady = Boolean(all || selectedCountry);

  const setOrder = useCallback(
    (next: FeedOrder) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("order", next);
      router.push(`/?${nextParams.toString()}`);
    },
    [router, searchParams],
  );

  return {
    order,
    setOrder,
    deleteMode,
    selectedCountry,
    selectedCity,
    all,
    headerTitle,
    isSelectionReady,
  };
}
