export function displayCountryName(country: string): string {
  return country === "Indonesia" ? "Bali" : country;
}

export function displayPlaceTitle(country: string, city: string): string {
  if (country === "Indonesia" && city === "Bali") return "Bali";
  if (country && city) return `${displayCountryName(country)} / ${city}`;
  return displayCountryName(country || city);
}

export function isBaliChapter(country: string, cities?: Array<{ city: string }>) {
  return country === "Indonesia" && cities?.some((city) => city.city === "Bali");
}
