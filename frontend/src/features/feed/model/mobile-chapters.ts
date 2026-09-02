import type { PlacesResponse } from "@/shared/api/api";
import { displayCountryName } from "@/features/places/model/place-labels";
export type MobileChapter = {
  country: string;
  city: string | null;
  label: string;
  count: number;
  cityCount: number;
};

export function buildMobileChapters(data?: PlacesResponse): MobileChapter[] {
  return (
    data?.countries.map((country) => {
      const cityCount = country.cities.length;
      const label = displayCountryName(country.country);
      return {
        country: country.country,
        city: cityCount === 1 ? country.cities[0].city : null,
        label,
        count: country.count,
        cityCount,
      };
    }) ?? []
  );
}
