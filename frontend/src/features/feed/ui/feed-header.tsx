"use client";

import { ChevronDown } from "lucide-react";

type FeedHeaderProps = {
  headerTitle: string;
  isSelectionReady: boolean;
  order: "asc" | "desc";
  onOrderChange: (next: "asc" | "desc") => void;
};

export function FeedHeader({
  headerTitle,
  isSelectionReady,
  order,
  onOrderChange,
}: FeedHeaderProps) {
  if (!isSelectionReady) return null;

  return (
    <header className="flex items-center justify-end">
      <span className="sr-only">{headerTitle}</span>
      <label className="travel-glass relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/70">
        <span className="text-white/42">Показывать:</span>
        <select
          value={order}
          onChange={(event) => onOrderChange(event.target.value as "asc" | "desc")}
          className="appearance-none bg-transparent pr-7 font-medium text-amber-100 outline-none"
          aria-label="Порядок постов"
        >
          <option value="desc">Сначала новые</option>
          <option value="asc">Сначала старые</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 size-4 text-amber-100/70" />
      </label>
    </header>
  );
}

type FeedEmptyStateProps = {
  isSelectionReady: boolean;
};

export function FeedEmptyState({ isSelectionReady }: FeedEmptyStateProps) {
  void isSelectionReady;
  return null;
}
