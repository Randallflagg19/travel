"use client";

import Image from "next/image";
import { UserRound } from "lucide-react";
import type { ApiAuthor } from "@/shared/api/api";

export function AuthorSelector({
  authors,
  selectedId,
  onSelect,
  compact = false,
}: {
  authors: ApiAuthor[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  if (authors.length === 0) return null;
  return (
    <nav aria-label="Авторы" className={compact ? "flex gap-2 overflow-x-auto py-1" : "space-y-2"}>
      {authors.map((author) => {
        const tapir = author.username.toLowerCase() === "tapir";
        const selected = selectedId === author.id;
        return (
          <button
            key={author.id}
            type="button"
            onClick={() => onSelect(author.id)}
            aria-pressed={selected}
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 ${compact ? "shrink-0" : "w-full"} ${selected ? (tapir ? "border-emerald-300/60 bg-emerald-400/16 text-emerald-50" : "border-violet-300/70 bg-violet-500/25 text-violet-50") : "border-white/10 bg-white/[0.035] text-white/65 hover:border-violet-300/30 hover:bg-violet-500/10"}`}
          >
            {tapir ? (
              <span className="relative size-6 shrink-0 overflow-hidden rounded-md bg-[#061014]">
                <Image src="/first-screen/sidebar/tapir-mascot-dark-bg.png" alt="" fill sizes="24px" className="object-contain" />
              </span>
            ) : (
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-violet-400/20 text-violet-200">
                <UserRound className="size-4" aria-hidden="true" />
              </span>
            )}
            <span className="truncate">{author.name?.trim() || author.username}</span>
          </button>
        );
      })}
    </nav>
  );
}
