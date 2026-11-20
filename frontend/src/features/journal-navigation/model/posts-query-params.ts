export function buildPostsCountryCityFilter({
  all,
  selectedCountry,
  selectedCity,
  isCountryFeed,
}: {
  all: boolean;
  selectedCountry: string;
  selectedCity: string;
  isCountryFeed: boolean;
}): { country?: string; city?: string } {
  if (all) return {};

  if (selectedCountry && selectedCity) {
    return { country: selectedCountry, city: selectedCity };
  }

  if (isCountryFeed && selectedCountry) {
    return { country: selectedCountry };
  }

  return {};
}
