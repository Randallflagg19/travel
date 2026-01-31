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
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{headerTitle}</h1>
      </div>
      {isSelectionReady ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Порядок:</span>
          <Button
            variant={order === "desc" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onOrderChange("desc")}
            aria-label="Сначала новые"
          >
            <ArrowDownAZ className="size-4" />
          </Button>
          <Button
            variant={order === "asc" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onOrderChange("asc")}
            aria-label="Сначала старые"
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
      <Card>
        <CardHeader>
          <CardTitle>Выбери место слева</CardTitle>
          <CardDescription>Страна → город. Или нажми &quot;Все посты&quot;.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
