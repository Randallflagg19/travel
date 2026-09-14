"use client";

import { useState } from "react";
import {
  Maximize2,
  Minimize2,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";

type PostActionsMenuProps = {
  onEdit: () => void;
  onDelete: () => void;
  isFeatured?: boolean;
  onToggleFeatured?: () => void;
  variant?: "default" | "story";
};

export function PostActionsMenu({
  onEdit,
  onDelete,
  isFeatured = false,
  onToggleFeatured,
  variant = "default",
}: PostActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const isStory = variant === "story";

  return (
    <div className="pointer-events-auto relative z-20 shrink-0">
      <button
        type="button"
        className={`flex size-8 cursor-pointer items-center justify-center rounded-full shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
          isStory
            ? "border border-[#594837]/35 bg-[#f4ead7]/25 text-[#594837] hover:bg-[#f4ead7]/55 focus-visible:outline-[#594837]"
            : "bg-black/45 text-white/85 backdrop-blur hover:bg-black/70 hover:text-white focus-visible:outline-white/85"
        }`}
        aria-label="Действия с постом"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreVertical className="size-4" />
      </button>
      {open ? (
        <div
          className={`absolute bottom-0 right-full mr-2 w-52 overflow-hidden rounded-xl border p-1.5 text-sm shadow-2xl transition-colors ${
            isStory
              ? "border-[#796752]/25 bg-[#f4ead7] text-[#4b3d30]"
              : "border-[#071014] bg-[#101b1e] text-amber-50 hover:bg-[#1d2b2e]"
          }`}
        >
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/10"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Pencil className="size-4" />
            Редактировать
          </button>
          {onToggleFeatured ? (
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/10"
              onClick={() => {
                setOpen(false);
                onToggleFeatured();
              }}
            >
              {isFeatured ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
              {isFeatured ? "Обычный размер" : "Сделать крупным"}
            </button>
          ) : null}
          <div className="my-1 border-t border-current/10" />
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-red-400 transition hover:bg-red-500/10"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 className="size-4" />
            Удалить
          </button>
        </div>
      ) : null}
    </div>
  );
}
