"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Palmtree, Trash2 } from "lucide-react";
import { fetchPlaces } from "@/shared/api/api";
import { useAuth } from "@/entities/session/model/auth";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";
import {
  displayCountryName,
  shouldOpenCountryDirectly,
} from "@/features/places/model/place-labels";

function buildUrl(params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function PlacesSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const deleteMode = searchParams.get("delete") === "1";
  const canDelete = Boolean(
    auth.user && (auth.user.role === "ADMIN" || auth.user.role === "SUPERADMIN"),
  );

  const selectedCountry = searchParams.get("country") ?? "";
  const selectedCity = searchParams.get("city") ?? "";
  const all = searchParams.get("all") === "true";

  const placesQuery = useQuery({
    queryKey: ["places"],
    queryFn: fetchPlaces,
  });

  const initialOpen = useMemo(() => {
    return selectedCountry;
  }, [selectedCountry]);

  const [openCountry, setOpenCountry] = useState<string>(initialOpen);

  function selectCity(country: string, city: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("all");
    next.set("country", country);
    next.set("city", city);
    router.push(buildUrl(next));
    onNavigate?.();
  }

  function selectCountry(country: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("all");
    next.delete("city");
    next.set("country", country);
    router.push(buildUrl(next));
    setOpenCountry(country);
    onNavigate?.();
  }

  function selectAll() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("country");
    next.delete("city");
    next.set("all", "true");
    router.push(buildUrl(next));
    onNavigate?.();
  }

  function selectHome() {
    router.push("/");
    onNavigate?.();
  }

  function toggleDeleteMode() {
    const next = new URLSearchParams(searchParams.toString());
    if (deleteMode) next.delete("delete");
    else next.set("delete", "1");
    router.push(buildUrl(next));
    onNavigate?.();
  }

  return (
    <aside className="flex h-dvh flex-col gap-4 border-r border-white/10 bg-[#071014]/86 text-white backdrop-blur-xl">
      <div className="px-5 pt-6">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-3xl text-left transition hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
          onClick={selectHome}
          aria-label="Вернуться на главную"
        >
          <div className="relative size-14 overflow-hidden rounded-2xl bg-amber-300 shadow-lg shadow-amber-500/20 ring-1 ring-amber-200/40">
            <Image
              src="/tapir-travel.png"
              alt="Tapir Travel"
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
          <div className="min-w-0">
            <div className="font-serif text-2xl font-semibold italic tracking-tight text-amber-200">
              Tapir Travel
            </div>
            <p className="text-xs text-white/45">Коллекционируй моменты.</p>
          </div>
        </button>
      </div>

      <div className="space-y-2 px-5">
        {canDelete ? (
          <Button
            variant={deleteMode ? "destructive" : "ghost"}
            className="w-full justify-start rounded-2xl text-white/80 hover:bg-white/10 hover:text-white"
            onClick={toggleDeleteMode}
          >
            <Trash2 className="mr-2 size-4" />
            {deleteMode ? "Выключить удаление" : "Удаление"}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className={`w-full justify-start rounded-2xl border ${
            all
              ? "border-amber-300/25 bg-amber-300/15 text-amber-100"
              : "border-white/10 bg-white/[0.035] text-white/75 hover:bg-white/10 hover:text-white"
          }`}
          onClick={selectAll}
        >
          <Palmtree className="mr-2 size-4" />
          Все посты
        </Button>
      </div>

      <Separator className="bg-white/10" />

      <ScrollArea className="flex-1 px-3 pb-6">
        {placesQuery.isLoading ? (
          <div className="space-y-3 px-2">
            <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
            <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
            <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
          </div>
        ) : placesQuery.isError ? (
          <div className="px-2 text-sm text-white/55">
            {placesQuery.error instanceof Error
              ? placesQuery.error.message
              : "Не удалось загрузить места"}
          </div>
        ) : (
          <div className="space-y-3 px-2">
            {placesQuery.data?.countries.map((c) => {
              const isOpen = openCountry === c.country;
              const isActiveCountry = selectedCountry === c.country;
              const opensDirectly = shouldOpenCountryDirectly(c.cities);
              const displayCountry = displayCountryName(c.country);
              const directCity = c.cities[0];
              const isActiveDirect =
                opensDirectly &&
                selectedCountry === c.country &&
                selectedCity === directCity?.city;

              return (
                <div key={c.country} className="rounded-2xl">
                  <Button
                    variant="ghost"
                    className={`h-auto w-full justify-start rounded-2xl border px-3 py-3 text-left ${
                      isActiveCountry || isActiveDirect
                        ? "border-emerald-300/25 bg-emerald-400/15 text-white shadow-lg shadow-emerald-950/20"
                        : "border-white/10 bg-white/[0.035] text-white/78 hover:bg-white/10 hover:text-white"
                    }`}
                    onClick={() => {
                      if (opensDirectly && directCity) selectCity(c.country, directCity.city);
                      else selectCountry(c.country);
                    }}
                  >
                    <span className="mr-3 flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                      {displayCountry === "Thailand"
                        ? "🏯"
                        : displayCountry === "China"
                          ? "🐉"
                          : "✈️"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {displayCountry}
                      </span>
                    </span>
                    <span className="ml-auto text-xs text-white/45">{c.count}</span>
                  </Button>

                  {isOpen && c.cities.length > 1 ? (
                    <div className="ml-5 mt-2 space-y-1 border-l border-white/10 pl-3">
                      {c.cities.map((cc) => {
                        const isActiveCity =
                          selectedCountry === c.country && selectedCity === cc.city;
                        return (
                          <Button
                            key={cc.city}
                            variant="ghost"
                            className={`h-9 w-full justify-start rounded-xl ${
                              isActiveCity
                                ? "bg-white/12 text-amber-100"
                                : "text-white/62 hover:bg-white/10 hover:text-white"
                            }`}
                            onClick={() => selectCity(c.country, cc.city)}
                          >
                            <MapPin className="mr-2 size-3.5" />
                            {cc.city}
                            <span className="ml-auto text-xs text-white/42">
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
