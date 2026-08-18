export function displayCountryName(country: string): string {
  return country;
}

export function displayPlaceTitle(country: string, city: string): string {
  if (country && city && country === city) return displayCountryName(country);
  if (country && city) return `${displayCountryName(country)} / ${city}`;
  return displayCountryName(country || city);
}

export function shouldOpenCountryDirectly(cities?: Array<{ city: string }>) {
  return (cities?.length ?? 0) === 1;
}
