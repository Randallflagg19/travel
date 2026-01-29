"use client";

import { useSearchParams } from "next/navigation";
import { MobilePlaces } from "@/components/mobile-places";

function useHeaderText() {
  const searchParams = useSearchParams();

  const country = searchParams.get("country") ?? "";
  const city = searchParams.get("city") ?? "";
  const unknown = searchParams.get("unknown") === "true";
  const all = searchParams.get("all") === "true";

  if (unknown) {
    return { title: "Unknown", subtitle: "Посты без страны/города" };
  }

  if (all) {
    return { title: "Все посты", subtitle: "Общая лента" };
  }

  if (country && city) {
    return { title: `${country} / ${city}`, subtitle: "Лента" };
  }

  return { title: "Места", subtitle: "Выбери страну и город" };
}

export function MobileHeader() {
  const { title, subtitle } = useHeaderText();

  return (
    <div className="supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 flex items-center gap-3 border-b bg-background/90 px-3 py-2 backdrop-blur lg:hidden">
      <MobilePlaces />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="text-muted-foreground truncate text-xs">{subtitle}</div>
      </div>
    </div>
  );
}

