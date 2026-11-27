"use client";

import { ChevronDown } from "lucide-react";

type FeedHeaderProps = {
  headerTitle: string;
  isSelectionReady: boolean;
  showCountryFilters: boolean;
  order: "asc" | "desc";
  onOrderChange: (next: "asc" | "desc") => void;
};

export function FeedHeader({
  headerTitle,
  isSelectionReady,
  showCountryFilters,
  order,
  onOrderChange,
}: FeedHeaderProps) {
  if (!isSelectionReady) return null;

  return (
    <header className={`flex flex-wrap items-center gap-x-1.5 gap-y-2 ${showCountryFilters ? "justify-between border-t border-amber-100/10 pt-2.5" : "justify-end"}`}>
      <span className="sr-only">{headerTitle}</span>
      {showCountryFilters ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex min-h-11 items-center rounded-full border border-emerald-100/65 bg-emerald-100 px-1.5 text-xs font-medium text-emerald-950 sm:px-3 sm:text-sm lg:min-h-9">
            Все записи
          </span>
          <button
            type="button"
            disabled
            className="min-h-11 rounded-full border border-amber-100/10 bg-[#071014]/60 px-1.5 text-xs text-amber-50/50 sm:px-3 sm:text-sm lg:min-h-9"
          >
            Еда
          </button>
        </div>
      ) : null}
      <label className="relative inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-100/15 bg-[#071014]/60 px-2 text-xs text-amber-50/82 focus-within:ring-2 focus-within:ring-emerald-200/70 sm:px-3 sm:text-sm lg:min-h-9">
        {!showCountryFilters ? <span className="text-amber-50/55">Показывать:</span> : null}
        <select
          value={order}
          onChange={(event) =>
            onOrderChange(event.target.value as "asc" | "desc")
          }
          className="min-h-10 appearance-none bg-transparent pr-5 font-medium text-amber-50/82 outline-none lg:min-h-8"
          aria-label="Порядок постов"
        >
          <option value="desc">Сначала новые</option>
          <option value="asc">Сначала старые</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-amber-100/65 sm:right-3" />
      </label>
    </header>
  );
}
