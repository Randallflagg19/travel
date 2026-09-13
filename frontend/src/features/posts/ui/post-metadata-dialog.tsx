"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/shared/ui/button";

export type PostMetadata = {
  title: string;
  text: string;
};

type PostMetadataDialogProps = {
  open: boolean;
  initialValue?: Partial<PostMetadata>;
  title: string;
  submitLabel: string;
  variant?: "default" | "story";
  requireFields?: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: PostMetadata) => Promise<void> | void;
};

export function PostMetadataDialog({
  open,
  initialValue,
  title,
  submitLabel,
  variant = "default",
  requireFields = false,
  saving = false,
  onOpenChange,
  onSubmit,
}: PostMetadataDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
        {open ? (
          <PostMetadataDialogContent
            initialValue={initialValue}
            title={title}
            submitLabel={submitLabel}
            variant={variant}
            requireFields={requireFields}
            saving={saving}
            onSubmit={onSubmit}
          />
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PostMetadataDialogContent({
  initialValue,
  title,
  submitLabel,
  variant,
  requireFields,
  saving,
  onSubmit,
}: Omit<PostMetadataDialogProps, "open" | "onOpenChange">) {
  const [metadata, setMetadata] = useState<PostMetadata>(() => ({
    title: initialValue?.title ?? "",
    text: initialValue?.text ?? "",
  }));
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requireFields && (!metadata.title.trim() || !metadata.text.trim())) {
      setValidationError("Для истории нужны название и текст.");
      return;
    }
    await onSubmit({
      title: metadata.title.trim(),
      text: metadata.text.trim(),
    });
  }

  return (
    <Dialog.Content
      className={`fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-2xl focus:outline-none ${
        variant === "story"
          ? "border-[#796752]/25 bg-[#efe4ce] text-[#33291f]"
          : "border-amber-100/20 bg-[#0b1517] text-amber-50"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <Dialog.Title className="font-serif text-2xl">{title}</Dialog.Title>
        <Dialog.Close asChild>
          <button
            type="button"
            className={`rounded-full p-2 transition ${
              variant === "story"
                ? "text-[#594837] hover:bg-[#d5c8ae]/70"
                : "text-amber-50/75 hover:bg-white/10 hover:text-amber-50"
            }`}
            aria-label="Закрыть"
          >
            <X className="size-5" />
          </button>
        </Dialog.Close>
      </div>
      <Dialog.Description
        className={`mt-2 text-sm ${
          variant === "story" ? "text-[#594837]/80" : "text-amber-50/60"
        }`}
      >
        {requireFields
          ? "Название и текст истории можно изменить в любой момент."
          : "Оба поля необязательны. Их можно добавить или изменить позднее."}
      </Dialog.Description>
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label
          className={`block text-sm ${
            variant === "story" ? "text-[#4b3d30]" : "text-amber-50/80"
          }`}
        >
          {requireFields ? "Название истории" : "Название"}
          <input
            value={metadata.title}
            onChange={(event) =>
              setMetadata((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            maxLength={140}
            required={requireFields}
            placeholder="Например, Утро в Убуде"
            className={`mt-1.5 w-full rounded-lg border px-3 py-2 ${
              variant === "story"
                ? "border-[#796752]/25 bg-[#fffaf0] text-[#33291f] placeholder:text-[#796752]/65"
                : "border-white/15 bg-black/20 text-amber-50 placeholder:text-white/35"
            }`}
          />
        </label>
        <label
          className={`block text-sm ${
            variant === "story" ? "text-[#4b3d30]" : "text-amber-50/80"
          }`}
        >
          {requireFields ? "Текст истории" : "Описание"}
          <textarea
            value={metadata.text}
            onChange={(event) =>
              setMetadata((current) => ({
                ...current,
                text: event.target.value,
              }))
            }
            maxLength={12000}
            required={requireFields}
            placeholder="Короткая заметка о моменте"
            className={`mt-1.5 min-h-32 w-full resize-y rounded-lg border px-3 py-2 leading-relaxed ${
              variant === "story"
                ? "border-[#796752]/25 bg-[#fffaf0] text-[#33291f] placeholder:text-[#796752]/65"
                : "border-white/15 bg-black/20 text-amber-50 placeholder:text-white/35"
            }`}
          />
        </label>
        {validationError ? (
          <p className="text-sm text-red-600" role="alert">
            {validationError}
          </p>
        ) : null}
        <div className="flex justify-end gap-3 pt-1">
          <Dialog.Close asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              className={
                variant === "story"
                  ? "text-[#594837] hover:bg-[#d5c8ae]/70 hover:text-[#33291f]"
                  : undefined
              }
            >
              Отмена
            </Button>
          </Dialog.Close>
          <Button
            type="submit"
            disabled={saving}
            className={
              variant === "story"
                ? "bg-[#315b55] text-[#fffaf0] hover:bg-[#244943]"
                : undefined
            }
          >
            {saving ? "Сохраняю…" : submitLabel}
          </Button>
        </div>
      </form>
    </Dialog.Content>
  );
}
