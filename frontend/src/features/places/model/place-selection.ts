/** An unfiltered URL is the all-posts feed; explicit all overrides place filters. */
export function readPlaceSelection(params: { get(name: string): string | null }) {
  const country = params.get("country") ?? "";
  const city = params.get("city") ?? "";
  const all = params.get("all") === "true" || (!country && !city);

  return {
    all,
    selectedCountry: all ? "" : country,
    selectedCity: all ? "" : city,
  };
}
