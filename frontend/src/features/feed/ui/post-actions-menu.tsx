"use client";

import { useState } from "react";
import { MoreVertical, Pencil } from "lucide-react";

type PostActionsMenuProps = {
  onEdit: () => void;
};

export function PostActionsMenu({ onEdit }: PostActionsMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-auto relative z-20 shrink-0">
      <button
        type="button"
        className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white/85 shadow-sm backdrop-blur transition hover:bg-black/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white/85"
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
        <div className="absolute bottom-full right-0 mb-1 w-44 overflow-hidden rounded-xl border border-[#071014] bg-[#101b1e] text-sm text-amber-50 shadow-2xl transition-colors hover:bg-[#1d2b2e]">
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
