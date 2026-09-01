import type { PlacesResponse } from "@/shared/api/api";
import { useRouter, useSearchParams } from "next/navigation";
import { cityCountLabel, frameCountLabel } from "../model/feed-labels";
import { useMemo } from "react";
import {
  buildMobileChapters,
  type MobileChapter,
} from "../model/mobile-chapters";

export function MobileChapters({
  selectedCountry,
  places,
  isLoading,
}: {
  selectedCountry: string;
  places?: PlacesResponse;
  isLoading?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chapters = useMemo(() => buildMobileChapters(places), [places]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 lg:hidden" aria-label="Загрузка глав">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-3xl border border-white/10 bg-white/[0.055] p-3"
          >
            <div className="size-9 animate-pulse rounded-2xl bg-white/10" />
            <div className="mt-6 h-4 w-16 animate-pulse rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  if (chapters.length === 0) return null;

  function selectChapter(chapter: MobileChapter) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("all");
    next.set("country", chapter.country);
    if (chapter.city) next.set("city", chapter.city);
    else next.delete("city");
    router.push(`/?${next.toString()}`);
  }

  return (
    <div className="grid grid-cols-3 gap-3 lg:hidden">
      {chapters.map((chapter) => {
        const active = selectedCountry === chapter.country;
        return (
          <button
            key={`${chapter.country}/${chapter.city ?? "cities"}`}
            type="button"
            onClick={() => selectChapter(chapter)}
            className={`relative h-28 min-w-0 overflow-hidden rounded-3xl border p-3 text-left transition ${
              active
                ? "border-emerald-300/70 bg-emerald-300/14 shadow-lg shadow-emerald-950/30"
                : "border-white/10 bg-white/[0.055]"
            }`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,166,76,0.18),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01))]" />
            <div className="relative flex h-full flex-col justify-between">
              <span className="text-2xl">{chapter.emoji}</span>
              <span>
                <span className="block truncate font-serif text-lg italic leading-none text-amber-100">
                  {chapter.label}
                </span>
                <span className="mt-1 block truncate text-[11px] text-white/45">
                  {chapter.cityCount > 1
                    ? cityCountLabel(chapter.cityCount)
                    : frameCountLabel(chapter.count)}
                </span>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
