import * as Dialog from "@radix-ui/react-dialog";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { displayCountryName } from "@/entities/place";
import { createAlbum } from "@/shared/api/api";
import { Button } from "@/shared/ui/button";

export function JournalCreateAlbum({
  accessToken,
  country,
  onCreated,
}: {
  accessToken: string;
  country: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const submitting = useRef(false);
  const saveAlbum = useMutation({
    mutationFn: (title: string) => createAlbum(accessToken, { country, title }),
    retry: false,
    onSuccess: () => {
      setOpen(false);
      onCreated();
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  function changeOpen(nextOpen: boolean) {
    if (submitting.current) return;
    if (nextOpen) {
      setTitle("");
      saveAlbum.reset();
    }
    setOpen(nextOpen);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const albumTitle = title.trim();
    if (submitting.current || !albumTitle) return;
    submitting.current = true;
    saveAlbum.mutate(albumTitle);
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="Создать альбом"
          className="min-h-11 rounded-full border border-dashed border-emerald-200/28 bg-[#071014]/55 px-3 text-emerald-100/90 hover:border-emerald-200/50 hover:bg-emerald-200/10 hover:text-emerald-50 lg:min-h-9"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Альбом
        </Button>
      </Dialog.Trigger>
      {saveAlbum.data ? (
        <p role="status" className="sr-only">
          Альбом «{saveAlbum.data.album.title}» создан.
        </p>
      ) : null}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[71] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-amber-100/20 bg-[#0b1517] p-5 text-amber-50 shadow-2xl focus:outline-none">
          <Dialog.Title className="font-serif text-2xl">
            Создать альбом
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-amber-50/70">
            {displayCountryName(country)}
          </Dialog.Description>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit} aria-busy={saveAlbum.isPending}>
            <label className="block text-sm text-amber-50/85">
              Название альбома
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-amber-50 focus-visible:border-amber-100/60 focus-visible:outline-none disabled:opacity-60"
                disabled={saveAlbum.isPending}
                required
              />
            </label>
            {saveAlbum.isError ? (
              <p role="alert" className="text-sm text-red-200">
                Не удалось создать альбом. {saveAlbum.error.message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" disabled={saveAlbum.isPending}>
                  Отмена
                </Button>
              </Dialog.Close>
              <Button type="submit" variant="secondary" disabled={saveAlbum.isPending || !title.trim()}>
                {saveAlbum.isPending ? "Сохраняем…" : "Сохранить"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
