import { displayCountryName } from "@/features/places/model/place-labels";
import { PlacesResponse } from "@/shared/api/api";
import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { cityCountLabel, frameCountLabel } from "../model/feed-labels";

export function CitySelection({
  selectedCountry,
  places,
}: {
  selectedCountry: string;
  places?: PlacesResponse;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const country = places?.countries.find(
    (item) => item.country === selectedCountry,
  );

  if (!selectedCountry) return null;

  if (!places) {
    return (
      <Card className="travel-glass border-white/10 bg-white/[0.055]">
        <CardHeader>
          <CardTitle className="text-white">Собираю города…</CardTitle>
          <CardDescription className="text-white/55">
            Сейчас покажу, куда можно нырнуть внутри страны.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!country || country.cities.length <= 1) return null;

  const displayCountry = displayCountryName(selectedCountry);

  function selectCity(city: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("all");
    next.set("country", selectedCountry);
    next.set("city", city);
    router.push(`/?${next.toString()}`);
  }

  return (
    <section className="travel-glass hidden rounded-[1.7rem] border border-white/10 bg-white/[0.055] p-5 sm:p-6 lg:block">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-emerald-200/70">
        выбери город
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-4xl font-semibold italic text-amber-100 sm:text-5xl">
            {displayCountry}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55 sm:text-base">
            Здесь несколько направлений. Сначала выбери город — и откроется его
            отдельная лента.
          </p>
        </div>
        <span className="text-sm text-white/45">
          {cityCountLabel(country.cities.length)} ·{" "}
          {frameCountLabel(country.count)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {country.cities.map((city) => (
          <button
            key={city.city}
            type="button"
            onClick={() => selectCity(city.city)}
            className="group rounded-3xl border border-white/10 bg-[#071014]/70 p-4 text-left transition hover:border-emerald-200/35 hover:bg-emerald-300/10"
          >
            <span className="text-xs font-medium uppercase tracking-[0.24em] text-white/38">
              город
            </span>
            <span className="mt-2 block text-2xl font-semibold text-white transition group-hover:text-amber-100">
              {city.city}
            </span>
            <span className="mt-2 block text-sm text-white/45">
              {frameCountLabel(city.count)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
