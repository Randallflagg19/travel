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
  displayCountryImage,
  displayCountryName,
  shouldOpenCountryDirectly,
} from "@/features/places/model/place-labels";

function buildUrl(params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

const SIDEBAR_NOTE =
  "Места, в которых я оказался. Люди, которых встретил. Странные детали, случайные находки и фотографии, которые захотелось оставить себе.";

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
    <aside className="flex h-dvh flex-col gap-4 border-r border-amber-100/10 bg-[#061014]/88 pb-5 text-white shadow-2xl shadow-black/35 backdrop-blur-xl lg:h-fit lg:rounded-br-[2rem] lg:border-b">
      <div className="px-4 pt-5">
        <button
          type="button"
          className="flex w-full items-center gap-4 rounded-[1.35rem] px-3 py-2.5 text-left transition hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/55"
          onClick={selectHome}
          aria-label="Вернуться на главную"
        >
          <div className="relative size-16 shrink-0 overflow-hidden rounded-[1.15rem]">
            <Image
              src="/first-screen/sidebar/tapir-mascot-dark-bg.png"
              alt="Tapir Travel"
              fill
              className="object-contain"
              sizes="64px"
              priority
            />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="font-serif text-[1.35rem] font-medium text-amber-50/92">
              Tapir Travel
            </div>
            <p className="mt-0.5 font-serif text-[0.82rem] font-semibold text-orange-400">
              Журнал дороги
            </p>
          </div>
        </button>
      </div>

      <div className="space-y-2 px-4">
        {canDelete ? (
          <Button
            variant={deleteMode ? "destructive" : "ghost"}
            className="w-full justify-start rounded-2xl border border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={toggleDeleteMode}
          >
            <Trash2 className="mr-2 size-4" />
            {deleteMode ? "Выключить удаление" : "Удаление"}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className={`w-full justify-start rounded-2xl border font-medium ${
            all
              ? "border-emerald-300/35 bg-emerald-400/15 text-emerald-50 shadow-lg shadow-emerald-950/20"
              : "border-amber-100/10 bg-white/[0.035] text-white/78 hover:bg-white/10 hover:text-white"
          }`}
          onClick={selectAll}
        >
          <Palmtree className="mr-2 size-4" />
          Все посты
        </Button>
      </div>

      <Separator className="bg-white/10" />

      <ScrollArea className="min-h-0 flex-1 px-3 lg:flex-none">
        {placesQuery.isLoading ? (
          <div className="space-y-3 px-1">
            <Skeleton className="h-28 w-full rounded-[1.35rem] bg-white/10" />
            <Skeleton className="h-28 w-full rounded-[1.35rem] bg-white/10" />
            <Skeleton className="h-28 w-full rounded-[1.35rem] bg-white/10" />
          </div>
        ) : placesQuery.isError ? (
          <div className="px-2 text-sm text-white/55">
            {placesQuery.error instanceof Error
              ? placesQuery.error.message
              : "Не удалось загрузить места"}
          </div>
        ) : (
          <div className="space-y-3 px-1">
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
              const countryImage = displayCountryImage(displayCountry);

              return (
                <div key={c.country} className="rounded-[1.35rem]">
                  <button
                    type="button"
                    className={`group relative h-28 w-full overflow-hidden rounded-[1.35rem] border text-left shadow-lg shadow-black/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/70 ${
                      isActiveCountry || isActiveDirect
                        ? "border-emerald-300/70 ring-2 ring-emerald-300/25"
                        : "border-amber-100/10 hover:border-amber-100/25"
                    }`}
                    onClick={() => {
                      if (opensDirectly && directCity) selectCity(c.country, directCity.city);
                      else selectCountry(c.country);
                    }}
                  >
                    {countryImage ? (
                      <Image
                        src={countryImage}
                        alt=""
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(min-width: 1024px) 280px, 320px"
                      />
                    ) : (
                      <span className="absolute inset-0 bg-[linear-gradient(135deg,#263529,#172124_54%,#0a1317)]" />
                    )}
                    <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,12,13,0.10),rgba(5,12,13,0.55)_48%,rgba(5,12,13,0.86))]" />
                    <span className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]" />
                    <span className="relative flex h-full flex-col justify-end p-4">
                      <span className="block truncate font-serif text-2xl font-semibold italic text-amber-50 drop-shadow-md">
                        {displayCountry}
                      </span>
                      <span className="mt-1 inline-flex w-fit rounded-full border border-white/14 bg-black/22 px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-white/70 backdrop-blur-sm">
                        {c.count} постов
                      </span>
                    </span>
                  </button>

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
                                ? "bg-emerald-400/14 text-emerald-50"
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

      <div className="px-4">
        <div className="rounded-[1.35rem] border border-amber-100/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
          <p className="text-sm leading-6 text-amber-50/78">
            {SIDEBAR_NOTE}
          </p>
        </div>
      </div>
    </aside>
  );
}
