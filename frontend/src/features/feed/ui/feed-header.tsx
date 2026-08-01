"use client";

import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";

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
  return (
    <header className="flex items-center justify-end gap-3">
      <span className="sr-only">{headerTitle}</span>
      {isSelectionReady ? (
        <div className="travel-glass flex shrink-0 items-center gap-2 rounded-3xl p-1.5">
          <span className="hidden text-xs text-white/45 sm:inline">Порядок:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOrderChange("desc")}
            aria-label="Сначала новые"
            className={`rounded-2xl text-white/70 hover:bg-white/10 hover:text-white ${
              order === "desc" ? "bg-amber-300/15 text-amber-100" : ""
            }`}
          >
            <ArrowDownAZ className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOrderChange("asc")}
            aria-label="Сначала старые"
            className={`rounded-2xl text-white/70 hover:bg-white/10 hover:text-white ${
              order === "asc" ? "bg-amber-300/15 text-amber-100" : ""
            }`}
          >
            <ArrowUpAZ className="size-4" />
          </Button>
        </div>
      ) : null}
    </header>
  );
}

type FeedEmptyStateProps = {
  isSelectionReady: boolean;
};

export function FeedEmptyState({ isSelectionReady }: FeedEmptyStateProps) {
  if (isSelectionReady) return null;
  return (
    <div className="hidden lg:block">
      <Card className="travel-glass border-white/10 bg-white/[0.055]">
        <CardHeader>
          <CardTitle className="text-white">Выбери главу слева</CardTitle>
          <CardDescription className="text-white/55">
            Страна → город. Или нажми &quot;Все посты&quot;.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
