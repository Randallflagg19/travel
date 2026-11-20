"use client";

import { useEffect, useRef } from "react";
import {
  Maximize2,
  Minimize2,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";

type PostActionsMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  isFeatured?: boolean;
  onToggleFeatured?: () => void;
  isPinned?: boolean;
  onTogglePinned?: () => void;
  variant?: "default" | "story";
};

export function PostActionsMenu({
  open,
  onOpenChange,
  onEdit,
  onDelete,
  isFeatured = false,
  onToggleFeatured,
  isPinned = false,
  onTogglePinned,
  variant = "default",
}: PostActionsMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isStory = variant === "story";

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="pointer-events-auto relative z-20 shrink-0">
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
          onOpenChange(!open);
        }}
      >
        <MoreVertical className="size-4" />
      </button>
      {open ? (
        <div
          className={`absolute bottom-0 right-full mr-2 w-44 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border p-1.5 text-sm shadow-2xl transition-colors sm:w-52 ${
            isStory
              ? "border-[#796752]/25 bg-[#f4ead7] text-[#4b3d30]"
              : "border-[#071014] bg-[#101b1e] text-amber-50 hover:bg-[#1d2b2e]"
          }`}
        >
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/10"
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
          >
            <Pencil className="size-4" />
            Редактировать
          </button>
          {onTogglePinned ? (
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/10"
              onClick={() => {
                onOpenChange(false);
                onTogglePinned();
              }}
            >
              {isPinned ? (
                <PinOff className="size-4" />
              ) : (
                <Pin className="size-4" />
              )}
              {isPinned ? "Открепить" : "Закрепить"}
            </button>
          ) : null}
          {onToggleFeatured ? (
            <button
              type="button"
              className="hidden w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/10 lg:flex"
              onClick={() => {
                onOpenChange(false);
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
              onOpenChange(false);
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
