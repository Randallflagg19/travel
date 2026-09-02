import type { PlacesResponse } from "@/shared/api/api";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";
import { buildMobileChapters } from "../model/mobile-chapters";
import {
  displayCountryName,
  shouldOpenCountryDirectly,
} from "@/features/places/model/place-labels";

export function MobileChapters({
  selectedCountry,
  selectedCity,
  places,
  isLoading,
  order,
  onOrderChange,
}: {
  selectedCountry: string;
  selectedCity: string;
  places?: PlacesResponse;
  isLoading?: boolean;
  order: "asc" | "desc";
  onOrderChange: (next: "asc" | "desc") => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chapters = useMemo(() => buildMobileChapters(places), [places]);
  const selectedPlace = places?.countries.find(
    (item) => item.country === selectedCountry,
  );

  if (isLoading) {
    return (
      <div className="space-y-2 px-3 lg:hidden" aria-label="Загрузка глав">
        <div className="h-9 animate-pulse rounded-xl border border-white/10 bg-white/[0.055]" />
        <div className="flex gap-2">
          <div className="h-8 w-16 animate-pulse rounded-lg border border-white/10 bg-white/[0.055]" />
          <div className="h-8 w-16 animate-pulse rounded-lg border border-white/10 bg-white/[0.055]" />
          <div className="h-8 w-16 animate-pulse rounded-lg border border-white/10 bg-white/[0.055]" />
        </div>
      </div>
    );
  }

  if (chapters.length === 0) return null;

  function selectAll() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("country");
    next.delete("city");
    next.set("all", "true");
    router.push(`/?${next.toString()}`);
  }

  function selectCountry(country: string) {
    if (country === "__all") {
      selectAll();
      return;
    }

    const target = places?.countries.find((item) => item.country === country);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("all");
    next.set("country", country);
    if (shouldOpenCountryDirectly(target?.cities) && target?.cities[0]) {
      next.set("city", target.cities[0].city);
    } else {
      next.delete("city");
    }
    router.push(`/?${next.toString()}`);
  }

  function selectCity(city: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("all");
    next.set("country", selectedCountry);
    next.set("city", city);
    router.push(`/?${next.toString()}`);
  }

  return (
    <section className="space-y-2 px-3 lg:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] gap-2">
        <label className="relative min-w-0">
          <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[0.65rem] text-white/48">
            Страна:
          </span>
          <select
            value={selectedCountry || "__all"}
            onChange={(event) => selectCountry(event.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-emerald-300/20 bg-[#061014]/88 pl-[4.35rem] pr-8 text-xs text-amber-50 outline-none focus:border-emerald-300/55"
            aria-label="Выбрать страну"
          >
            <option value="__all">Все посты</option>
            {chapters.map((chapter) => (
              <option
                key={`${chapter.country}/${chapter.city ?? "cities"}`}
                value={chapter.country}
              >
                {displayCountryName(chapter.country)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-amber-100/70" />
        </label>

        <label className="relative flex size-9 items-center justify-center rounded-lg border border-amber-200/14 bg-[#061014]/88 text-amber-100/78">
          <SlidersHorizontal className="size-4" />
          <select
            value={order}
            onChange={(event) =>
              onOrderChange(event.target.value as "asc" | "desc")
            }
            className="absolute inset-0 cursor-pointer appearance-none opacity-0"
            aria-label="Порядок постов"
          >
            <option value="desc">Сначала новые</option>
            <option value="asc">Сначала старые</option>
          </select>
        </label>
      </div>

      {selectedPlace && selectedPlace.cities.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {selectedPlace.cities.map((city) => {
            const active = selectedCity === city.city;
            return (
              <button
                key={city.city}
                type="button"
                onClick={() => selectCity(city.city)}
                className={`h-8 shrink-0 rounded-lg border px-3 text-xs transition ${
                  active
                    ? "border-emerald-300/55 bg-emerald-400/18 text-emerald-50"
                    : "border-amber-100/12 bg-[#061014]/70 text-white/72"
                }`}
              >
                {city.city}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
