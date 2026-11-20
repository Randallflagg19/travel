"use client";

import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, X } from "lucide-react";
import type { ApiPost } from "@/shared/api/api";
import { Button } from "@/shared/ui/button";

type PostDeleteDialogProps = {
  post: ApiPost | null;
  deleting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function PostDeleteDialog({ post, deleting, error, onClose, onConfirm }: PostDeleteDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root open={post !== null} onOpenChange={(open) => { if (!open && !deleting) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          onOpenAutoFocus={(event) => { event.preventDefault(); cancelButton.current?.focus(); }}
          onEscapeKeyDown={(event) => { if (deleting) event.preventDefault(); }}
          onInteractOutside={(event) => event.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-100/20 bg-[#0b1517] p-5 text-amber-50 shadow-2xl focus:outline-none"
        >
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="font-serif text-2xl">Удалить публикацию?</Dialog.Title>
            <Button type="button" size="icon" variant="ghost" disabled={deleting} onClick={onClose} aria-label="Закрыть подтверждение удаления">
              <X className="size-5" />
            </Button>
          </div>
          {post?.title ? <p className="mt-3 break-words text-sm text-amber-50/85">{post.title}</p> : null}
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-amber-50/65">
            {post?.media_type === "STORY"
              ? "История будет удалена вместе с комментариями и реакциями."
              : "Публикация будет удалена вместе со всеми вложениями, комментариями и реакциями."}
          </Dialog.Description>
          {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200/20 bg-red-950/25 p-3 text-sm text-red-100">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-3">
            <Button ref={cancelButton} type="button" variant="ghost" disabled={deleting} onClick={onClose}>Отмена</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void onConfirm()}>
              {deleting ? <><LoaderCircle className="size-4 animate-spin" />Удаляем…</> : error ? "Повторить удаление" : "Удалить"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
