import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, X } from "lucide-react";
import { useState } from "react";
import {
  fetchAuthorCloudinaryStatus,
  saveAuthorCloudinaryConnection,
  type AuthorCloudinaryCredentials,
} from "@/shared/api/api";
import { Button } from "@/shared/ui/button";
import { JournalCloudinaryForm } from "./journal-cloudinary-form";

type ConnectionView = "connect" | "settings" | "replace";

const dialogTitles: Record<ConnectionView, string> = {
  connect: "Подключить Cloudinary",
  settings: "Настройки журнала",
  replace: "Заменить ключ Cloudinary",
};

export function JournalCloudinaryConnection({
  accessToken,
}: {
  accessToken: string;
}) {
  const [view, setView] = useState<ConnectionView | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = ["author-cloudinary", accessToken];
  const status = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchAuthorCloudinaryStatus(accessToken, signal),
    retry: false,
  });
  const connected = status.data?.connected === true;

  async function save(credentials: AuthorCloudinaryCredentials) {
    setSaving(true);
    try {
      const saved = await saveAuthorCloudinaryConnection(accessToken, credentials);
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData(queryKey, saved);
      setView(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root
      open={view !== null}
      onOpenChange={(open) => {
        if (!saving) setView(open ? (connected ? "settings" : "connect") : null);
      }}
    >
      {status.isPending ? (
        <p role="status" className="text-sm text-white/65">
          Проверяем подключение Cloudinary…
        </p>
      ) : status.isError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-red-100">
            Не удалось проверить подключение Cloudinary.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-white/80 hover:bg-white/10 hover:text-white"
            disabled={status.isFetching}
            onClick={() => void status.refetch()}
          >
            Повторить
          </Button>
        </div>
      ) : typeof status.data?.connected === "boolean" ? (
        <Dialog.Trigger asChild>
          <Button
            type="button"
            variant={connected ? "ghost" : "secondary"}
            size={connected ? "icon" : "default"}
            className={connected
              ? "self-start rounded-full text-amber-50/75 hover:bg-white/10 hover:text-amber-50"
              : "self-start"}
            aria-label={connected ? "Настройки журнала" : undefined}
            title={connected ? "Настройки журнала" : undefined}
          >
            {connected ? <Settings className="size-5" /> : "Подключить Cloudinary"}
          </Button>
        </Dialog.Trigger>
      ) : null}

      {view ? (
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-amber-100/20 bg-[#0b1517] p-5 text-amber-50 shadow-2xl focus:outline-none">
            <div className="flex items-center justify-between gap-4">
              <Dialog.Title className="font-serif text-2xl">{dialogTitles[view]}</Dialog.Title>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-amber-50/75 hover:bg-white/10 hover:text-amber-50"
                  aria-label="Закрыть"
                  disabled={saving}
                >
                  <X className="size-5" />
                </Button>
              </Dialog.Close>
            </div>
            {view === "settings" ? (
              <>
                <Dialog.Description className="sr-only">Действия с журналом автора.</Dialog.Description>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4"
                  onClick={() => setView("replace")}
                >
                  Заменить ключ Cloudinary
                </Button>
              </>
            ) : (
              <>
                <Dialog.Description className="mt-2 text-sm text-amber-50/70">
                  Введи данные API-ключа из своего аккаунта Cloudinary.
                </Dialog.Description>
                <JournalCloudinaryForm
                  defaultCloudName={view === "replace" ? status.data?.cloudName ?? "" : ""}
                  saving={saving}
                  onSave={save}
                />
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </Dialog.Root>
  );
}
