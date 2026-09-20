import type { PlacesResponse, PostTypeStats } from "@/shared/api/api";

export type FeedMediaStats = Pick<PostTypeStats, "photos" | "videos">;

const EMPTY_STATS: FeedMediaStats = { photos: 0, videos: 0 };

export function selectFeedMediaStats({
  places,
  all,
  selectedCountry,
  selectedCity,
}: {
  places?: PlacesResponse;
  all: boolean;
  selectedCountry: string;
  selectedCity: string;
}): FeedMediaStats | null {
  if (!places) return null;

  if (all) {
    return places.countries.reduce<FeedMediaStats>(
      (total, country) => ({
        photos: total.photos + country.stats.photos,
        videos: total.videos + country.stats.videos,
      }),
      { ...EMPTY_STATS },
    );
  }

  const country = places.countries.find(
    (item) => item.country === selectedCountry,
  );
  if (!country) return { ...EMPTY_STATS };

  if (!selectedCity) {
    return {
      photos: country.stats.photos,
      videos: country.stats.videos,
    };
  }

  const city = country.cities.find((item) => item.city === selectedCity);
  return city
    ? { photos: city.stats.photos, videos: city.stats.videos }
    : { ...EMPTY_STATS };
}
