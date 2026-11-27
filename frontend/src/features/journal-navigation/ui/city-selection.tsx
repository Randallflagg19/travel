import { Button } from "@/shared/ui/button";
import { useJournalRoutes } from "../model/use-journal-routes";

export function CitySelection({
  country,
  cities,
  selectedCity,
}: {
  country: string;
  cities: { city: string }[];
  selectedCity: string | null;
}) {
  const { selectCountry, selectCity } = useJournalRoutes();
  const choices = [
    { city: "", label: "Вся страна" },
    ...cities.map(({ city }) => ({ city, label: city })),
  ];

  return (
    <div className="grid gap-1.5 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <span id="journal-cities-label" className="text-sm text-amber-50/67 sm:pt-2">
        Города
      </span>
      <div role="group" aria-labelledby="journal-cities-label" className="flex min-w-0 flex-wrap gap-1.5">
        {choices.map(({ city, label }) => (
          <Button
            key={city}
            type="button"
            variant="ghost"
            aria-pressed={city === selectedCity}
            onClick={() => city ? selectCity(country, city) : selectCountry(country)}
            className="h-auto min-h-11 max-w-full min-w-0 rounded-full border border-amber-100/15 bg-[#071014]/60 px-3 py-1.5 text-amber-50/88 whitespace-normal wrap-anywhere hover:border-emerald-200/35 hover:bg-emerald-200/10 hover:text-amber-50 aria-pressed:border-emerald-100/65 aria-pressed:bg-emerald-100 aria-pressed:text-emerald-950 lg:min-h-9"
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
