export function displayCountryName(country: string): string {
  return country;
}

export function displayCountryIcon(countryOrLabel: string): string {
  if (countryOrLabel === "China") return "⛩️";
  if (countryOrLabel === "Egypt") return "𓂀";
  if (countryOrLabel === "Indonesia" || countryOrLabel === "Bali") return "🌋";
  if (countryOrLabel === "Thailand") return "🐘";
  return "✈️";
}

export function displayCountryImage(countryOrLabel: string): string | null {
  if (countryOrLabel === "China") {
    return "/first-screen/sidebar/country-china-bright.png";
  }
  if (countryOrLabel === "Egypt") {
    return "/first-screen/sidebar/country-egypt-bright.png";
  }
  if (countryOrLabel === "Indonesia" || countryOrLabel === "Bali") {
    return "/first-screen/sidebar/country-indonesia-bright.png";
  }
  if (countryOrLabel === "Thailand") {
    return "/first-screen/sidebar/country-thailand-bright.png";
  }
  return null;
}

export function displayPlaceTitle(country: string, city: string): string {
  if (country && city && country === city) return displayCountryName(country);
  if (country && city) return `${displayCountryName(country)} / ${city}`;
  return displayCountryName(country || city);
}

export function shouldOpenCountryDirectly(cities?: Array<{ city: string }>) {
  return (cities?.length ?? 0) === 1;
}
