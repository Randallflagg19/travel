import { useMemo } from "react";
import type { PlacesResponse } from "@/shared/api/api";

export function useJournalSelectionState({
  places,
  selectedCountry,
  selectedCity,
  all,
}: {
  places?: PlacesResponse;
  selectedCountry: string;
  selectedCity: string;
  all: boolean;
}) {
  const selectedCountryPlace = useMemo(
    () => places?.countries.find((item) => item.country === selectedCountry),
    [places, selectedCountry],
  );

  const hasCountryOnlySelection = Boolean(
    selectedCountry && !selectedCity && !all,
  );

  const isCountryFeed = Boolean(
    hasCountryOnlySelection && selectedCountryPlace,
  );

  const canLoadPosts = Boolean(all || selectedCity || isCountryFeed);

  return {
    selectedCountryPlace,
    isCountryFeed,
    canLoadPosts,
  };
}
