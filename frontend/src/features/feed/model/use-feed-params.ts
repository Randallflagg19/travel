"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type FeedOrder = "asc" | "desc";

export type FeedParams = {
  order: FeedOrder;
  setOrder: (next: FeedOrder) => void;
  deleteMode: boolean;
  selectedCountry: string;
  selectedCity: string;
  unknown: boolean;
  all: boolean;
  headerTitle: string;
  isSelectionReady: boolean;
};

export function useFeedParams(): FeedParams {
  const router = useRouter();
  const searchParams = useSearchParams();

  const order: FeedOrder =
    searchParams.get("order") === "desc" ? "desc" : "asc";
  const deleteMode = searchParams.get("delete") === "1";
  const selectedCountry = searchParams.get("country") ?? "";
  const selectedCity = searchParams.get("city") ?? "";
  const unknown = searchParams.get("unknown") === "true";
  const all = searchParams.get("all") === "true";

  const headerTitle = unknown
    ? "Unknown"
    : all
      ? "Все посты"
      : selectedCountry && selectedCity
        ? `${selectedCountry} / ${selectedCity}`
        : "Места";

  const isSelectionReady = Boolean(
    all || unknown || (selectedCountry && selectedCity),
  );

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
    unknown,
    all,
    headerTitle,
    isSelectionReady,
  };
}
