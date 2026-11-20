/* eslint-disable @next/next/no-img-element -- previews are local object URLs */
"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { LOCAL_MEDIA_LIMITS, MediaPublishingUnavailableError, cancelMediaSession, completeMedia, localMediaType, openMediaSession,
  publishMedia, reserveMedia, uploadToCloudinary, type PublicationInput } from "../model/media-upload";

type LocalMedia = { id: string; file: File; url: string; type: "PHOTO" | "VIDEO";
  status: "local" | "uploading" | "ready" | "error"; progress: number; error?: string };

export function MediaPostComposer({ accessToken, initialCountry, initialCity, onClose }: {
  accessToken: string; initialCountry: string; initialCity: string; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [files, setFiles] = useState<LocalMedia[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const sessionAttempted = useRef(false);
  const prepared = useRef<PublicationInput | null>(null);
  const readyFiles = useRef(new Set<string>());
  const urls = useRef(new Set<string>());
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previews = urls.current;
    return () => {
      controller.current?.abort();
      for (const url of previews) URL.revokeObjectURL(url);
    };
  }, []);

  function update(id: string, patch: Partial<LocalMedia>) {
    setFiles((current) => current.map((file) => file.id === id ? { ...file, ...patch } : file));
  }

  function selectFiles(selected: FileList | null) {
    if (!selected || busyRef.current || locked) return;
    const incoming = Array.from(selected);
    if (files.length + incoming.length > LOCAL_MEDIA_LIMITS.count) {
      setError("В публикации может быть не больше 10 файлов. Выберите меньше файлов.");
      return;
    }
    const additions: LocalMedia[] = [];
    for (const file of incoming) {
      const type = localMediaType(file);
      const max = type === "PHOTO" ? LOCAL_MEDIA_LIMITS.photoBytes : LOCAL_MEDIA_LIMITS.videoBytes;
      if (!type || file.size < 1 || file.size > max) {
        for (const item of additions) { URL.revokeObjectURL(item.url); urls.current.delete(item.url); }
        setError(`«${file.name}»: выберите фото до 20 МБ или видео до 90 МБ. Аудио и другие файлы не поддерживаются.`);
        return;
      }
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      additions.push({ id: crypto.randomUUID(), file, url, type, status: "local", progress: 0 });
    }
    setError(null);
    setFiles((current) => [...current, ...additions]);
  }

  function move(index: number, direction: -1 | 1) {
    if (busyRef.current || locked) return;
    setFiles((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }

  function remove(file: LocalMedia) {
    if (busyRef.current || locked) return;
    URL.revokeObjectURL(file.url);
    urls.current.delete(file.url);
    readyFiles.current.delete(file.id);
    setFiles((current) => current.filter((item) => item.id !== file.id));
  }

  function published() {
    // A failed feed refresh must not look like a failed publication.
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
    void queryClient.invalidateQueries({ queryKey: ["places"] });
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current || !files.length) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      if (!prepared.current) {
        sessionAttempted.current = true;
        await openMediaSession(accessToken, sessionId, abort.signal);
        let failed = false;
        for (const item of files) {
          if (readyFiles.current.has(item.id)) continue;
          update(item.id, { status: "uploading", progress: 0, error: undefined });
          try {
            const reservation = await reserveMedia(accessToken, sessionId, item.id, item.type, item.file.size, abort.signal);
            // Recover an upload whose successful response was lost.
            let ready = reservation.ready || (await completeMedia(accessToken, sessionId, item.id, abort.signal)).ready;
            if (!ready) {
              try {
                await uploadToCloudinary(item.file, reservation, (progress) => update(item.id, { progress }), abort.signal);
              } catch (uploadError) {
                if (abort.signal.aborted) throw uploadError;
                ready = (await completeMedia(accessToken, sessionId, item.id, abort.signal)).ready;
                if (!ready) throw uploadError;
              }
              if (!ready) ready = (await completeMedia(accessToken, sessionId, item.id, abort.signal)).ready;
            }
            if (!ready) throw new Error("Файл ещё не подтвердился. Повторите загрузку.");
            readyFiles.current.add(item.id);
            update(item.id, { status: "ready", progress: 100 });
          } catch (fileError) {
            if (abort.signal.aborted) throw fileError;
            failed = true;
            update(item.id, { status: "error", error: fileError instanceof Error ? fileError.message : "Не удалось загрузить файл" });
          }
        }
        if (failed) { setError("Публикация пока не создана. Повторите загрузку или уберите файлы с ошибкой — готовые файлы сохранятся."); return; }
        prepared.current = { uploadIds: files.map((file) => file.id), title: title.trim(), text: text.trim(), country: initialCountry.trim(), city: initialCity.trim() };
        setLocked(true);
      }
      await publishMedia(accessToken, sessionId, prepared.current, abort.signal);
      published();
    } catch (submitError) {
      if (submitError instanceof MediaPublishingUnavailableError) {
        // The server has no session endpoint, so nothing was created to cancel.
        sessionAttempted.current = false;
        setError(submitError.message);
      } else if (!abort.signal.aborted) setError(prepared.current
        ? "Не удалось получить подтверждение публикации. Нажмите «Повторить публикацию»: повтор не создаст второй пост."
        : submitError instanceof Error ? `Не удалось начать публикацию: ${submitError.message}` : "Не удалось начать публикацию. Попробуйте ещё раз.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function close() {
    if (busyRef.current) return;
    if (!sessionAttempted.current) { onClose(); return; }
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await cancelMediaSession(accessToken, sessionId);
      if (result.postId) published(); else onClose();
    } catch {
      setError("Не удалось закрыть загрузку. Повторите отмену; готовые файлы и текст пока сохранены.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const disabled = busy || locked;
  const hasErrors = files.some((file) => file.status === "error");
  return <Dialog.Root open onOpenChange={(open) => { if (!open) void close(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm" />
      <Dialog.Content aria-describedby="media-composer-description"
        onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
        onInteractOutside={(event) => event.preventDefault()}
        className="fixed left-1/2 top-1/2 z-[71] flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-amber-100/20 bg-[#0b1517] text-amber-50 shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <Dialog.Title className="font-serif text-2xl">Новая публикация</Dialog.Title>
          <button type="button" aria-label="Закрыть создание публикации" disabled={busy} onClick={() => void close()} className="rounded-full p-2 hover:bg-white/10 disabled:opacity-40"><X /></button>
        </header>
        <form onSubmit={(event) => void submit(event)} className="overflow-y-auto px-5 py-4">
          <Dialog.Description id="media-composer-description" className="mb-4 text-sm leading-relaxed text-amber-50/65">
            До 10 фото и видео в одном посте. Первый файл — обложка. Файлы отправятся только после нажатия «Опубликовать».
          </Dialog.Description>
          <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/gif,video/*,.heic,.heif,.mkv"
            className="sr-only" aria-label="Выбрать фото и видео" disabled={disabled}
            onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} />
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" disabled={disabled || files.length >= 10} onClick={() => input.current?.click()}><Plus className="size-4" />Добавить файлы</Button>
            <span className="text-sm text-amber-50/65" aria-live="polite">{files.length} / 10</span>
          </div>
          <ol className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Файлы публикации">
            {files.map((item, index) => <li key={item.id} className="overflow-hidden rounded-xl border border-white/15 bg-black/20">
              <div className="relative aspect-square bg-black/40">
                {item.type === "VIDEO" ? <video src={item.url} controls playsInline preload="metadata" className="h-full w-full object-contain" aria-label={`Превью ${item.file.name}`}
                  onPlay={(event) => {
                    const current = event.currentTarget;
                    current.closest("ol")?.querySelectorAll("video").forEach((video) => { if (video !== current) video.pause(); });
                  }} />
                  : <img src={item.url} alt={item.file.name} className="h-full w-full object-contain" />}
                <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs">{index === 0 ? "Обложка" : index + 1}</span>
              </div>
              <div className="space-y-2 p-2">
                <p className="truncate text-xs" title={item.file.name}>{item.file.name}</p>
                <div className="flex items-center justify-between">
                  <button type="button" aria-label={`Переместить ${item.file.name} раньше`} disabled={disabled || index === 0} onClick={() => move(index, -1)} className="flex size-10 items-center justify-center rounded hover:bg-white/10 disabled:opacity-25"><ArrowLeft className="size-4" /></button>
                  <button type="button" aria-label={`Переместить ${item.file.name} позже`} disabled={disabled || index === files.length - 1} onClick={() => move(index, 1)} className="flex size-10 items-center justify-center rounded hover:bg-white/10 disabled:opacity-25"><ArrowRight className="size-4" /></button>
                  <button type="button" aria-label={`Убрать ${item.file.name}`} disabled={disabled} onClick={() => remove(item)} className="flex size-10 items-center justify-center rounded text-red-200 hover:bg-white/10 disabled:opacity-25"><Trash2 className="size-4" /></button>
                </div>
                <div className="min-h-5 text-xs" role="status">
                  {item.status === "ready" ? <span className="inline-flex items-center gap-1 text-[#83c8b6]"><Check className="size-3" />Загружено</span>
                    : item.status === "uploading" ? <span>Отправка {item.progress}%</span> : item.status === "error" ? <span className="text-red-200">{item.error}</span> : <span className="text-white/45">На устройстве</span>}
                </div>
              </div>
            </li>)}
          </ol>
          <fieldset disabled={disabled} className="space-y-4 disabled:opacity-65">
            <label className="block text-sm">Название <span className="text-white/45">необязательно</span>
              <input value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2" />
            </label>
            <label className="block text-sm">Описание <span className="text-white/45">необязательно</span>
              <textarea value={text} maxLength={12000} onChange={(event) => setText(event.target.value)} className="mt-1.5 min-h-28 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2" />
            </label>
          </fieldset>
          <p className="mt-4 text-xs text-amber-50/50">Фото до 20 МБ. Видео до 90 МБ и 10 минут. Для текста без файлов используйте «История».</p>
          {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200/20 bg-red-950/25 p-3 text-sm text-red-100">{error}</p> : null}
          <footer className="sticky -bottom-4 mt-5 flex flex-wrap justify-end gap-3 border-t border-white/10 bg-[#0b1517] py-4">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void close()}>Отмена</Button>
            <Button type="submit" disabled={busy || !files.length}>{busy ? <><LoaderCircle className="size-4 animate-spin" />Публикуем…</>
              : locked ? "Повторить публикацию" : hasErrors ? "Повторить загрузку и опубликовать" : "Опубликовать"}</Button>
          </footer>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
