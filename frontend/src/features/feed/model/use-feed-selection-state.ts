import { useMemo } from "react";
import type { PlacesResponse } from "@/shared/api/api";

export function useFeedSelectionState({
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

  const isCitySelection = Boolean(
    hasCountryOnlySelection &&
    selectedCountryPlace &&
    selectedCountryPlace.cities.length > 1,
  );

  const isCountryFeed = Boolean(
    hasCountryOnlySelection &&
    selectedCountryPlace &&
    selectedCountryPlace.cities.length === 0,
  );

  const canLoadPosts = Boolean(all || selectedCity || isCountryFeed);

  return {
    selectedCountryPlace,
    hasCountryOnlySelection,
    isCitySelection,
    isCountryFeed,
    canLoadPosts,
  };
}
