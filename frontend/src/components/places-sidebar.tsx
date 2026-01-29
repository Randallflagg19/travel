"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchPlaces } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function buildUrl(params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function PlacesSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCountry = searchParams.get("country") ?? "";
  const selectedCity = searchParams.get("city") ?? "";
  const unknown = searchParams.get("unknown") === "true";

  const placesQuery = useQuery({
    queryKey: ["places"],
    queryFn: fetchPlaces,
  });

  const initialOpen = useMemo(() => {
    if (unknown) return "";
    return selectedCountry;
  }, [selectedCountry, unknown]);

  const [openCountry, setOpenCountry] = useState<string>(initialOpen);

  function selectCity(country: string, city: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("unknown");
    next.set("country", country);
    next.set("city", city);
    router.push(buildUrl(next));
  }

  function selectUnknown() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("country");
    next.delete("city");
    next.set("unknown", "true");
    router.push(buildUrl(next));
  }

  function clearSelection() {
    router.push("/");
  }

  return (
    <aside className="flex h-dvh flex-col gap-4 border-r bg-background">
      <div className="px-4 pt-6">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight">Места</h2>
          <p className="text-muted-foreground text-xs">
            Выбери страну → город, чтобы открыть ленту.
          </p>
        </div>
      </div>

      <div className="px-4">
        <Button variant="ghost" className="w-full justify-start" onClick={clearSelection}>
          Все посты
        </Button>
        <Button
          variant={unknown ? "secondary" : "ghost"}
          className="mt-1 w-full justify-start"
          onClick={selectUnknown}
        >
          Unknown
          {placesQuery.data?.unknown.count ? (
            <span className="text-muted-foreground ml-auto text-xs">
              {placesQuery.data.unknown.count}
            </span>
          ) : null}
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-2 pb-6">
        {placesQuery.isLoading ? (
          <div className="space-y-2 px-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : placesQuery.isError ? (
          <div className="text-muted-foreground px-2 text-sm">
            {placesQuery.error instanceof Error
              ? placesQuery.error.message
              : "Не удалось загрузить места"}
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {placesQuery.data?.countries.map((c) => {
              const isOpen = openCountry === c.country;
              const isActiveCountry = !unknown && selectedCountry === c.country;

              return (
                <div key={c.country} className="rounded-lg">
                  <Button
                    variant={isActiveCountry ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setOpenCountry(isOpen ? "" : c.country)}
                  >
                    {c.country}
                    <span className="text-muted-foreground ml-auto text-xs">{c.count}</span>
                  </Button>

                  {isOpen ? (
                    <div className="ml-2 mt-1 space-y-1 border-l pl-2">
                      {c.cities.map((cc) => {
                        const isActiveCity =
                          !unknown && selectedCountry === c.country && selectedCity === cc.city;
                        return (
                          <Button
                            key={cc.city}
                            variant={isActiveCity ? "secondary" : "ghost"}
                            className="h-8 w-full justify-start"
                            onClick={() => selectCity(c.country, cc.city)}
                          >
                            {cc.city}
                            <span className="text-muted-foreground ml-auto text-xs">
                              {cc.count}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}

