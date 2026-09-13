"use client";

import { useState } from "react";
import { MoreVertical, Pencil } from "lucide-react";

type PostActionsMenuProps = {
  onEdit: () => void;
  variant?: "default" | "story";
};

export function PostActionsMenu({
  onEdit,
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
          className={`absolute right-full top-1/2 mr-2 w-44 -translate-y-1/2 overflow-hidden rounded-xl border text-sm shadow-2xl transition-colors ${
            isStory
              ? "border-[#796752]/25 bg-[#f4ead7] text-[#4b3d30]"
              : "border-[#071014] bg-[#101b1e] text-amber-50 hover:bg-[#1d2b2e]"
          }`}
        >
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Pencil className="size-4" />
            Редактировать
          </button>
        </div>
      ) : null}
    </div>
  );
}
