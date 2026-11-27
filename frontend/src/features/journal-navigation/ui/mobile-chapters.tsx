import { ChevronDown } from "lucide-react";
import { displayCountryName } from "@/entities/place";
import type { PlacesResponse } from "@/shared/api/api";
import { useJournalRoutes } from "../model/use-journal-routes";

export function MobileChapters({
  selectedCountry,
  places,
  isLoading,
}: {
  selectedCountry: string;
  places?: PlacesResponse;
  isLoading?: boolean;
}) {
  const { selectAll, selectCountry } = useJournalRoutes();
  const countries = places?.countries ?? [];

  if (isLoading) {
    return (
      <div
        className="h-9 animate-pulse rounded-xl border border-white/10 bg-white/[0.055] lg:hidden"
        aria-label="Загрузка глав"
      />
    );
  }

  if (!countries.length) return null;

  return (
    <label className="relative min-w-0 lg:hidden">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[0.65rem] text-white/48">
        Страна:
      </span>
      <select
        value={selectedCountry || "__all"}
        onChange={(event) => {
          const country = event.target.value;
          if (country === "__all") selectAll();
          else selectCountry(country);
        }}
        className="h-9 w-full appearance-none rounded-lg border border-emerald-300/20 bg-[#061014]/88 pl-[4.35rem] pr-8 text-xs text-amber-50 outline-none focus:border-emerald-300/55"
        aria-label="Выбрать страну"
      >
        <option value="__all">Все посты</option>
        {countries.map(({ country }) => (
          <option key={country} value={country}>
            {displayCountryName(country)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-amber-100/70" />
    </label>
  );
}
