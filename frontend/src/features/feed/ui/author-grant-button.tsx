"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRoundPlus, X } from "lucide-react";
import { useAuth } from "@/entities/session/model/auth";
import { fetchAuthorCandidates, grantAuthorRole } from "@/shared/api/api";
import { Button } from "@/shared/ui/button";

export function AuthorGrantButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSuperadmin = auth.user?.role === "SUPERADMIN";
  const candidatesQuery = useQuery({
    queryKey: ["authors", "candidates"],
    queryFn: () => fetchAuthorCandidates(auth.accessToken as string),
    enabled: Boolean(open && isSuperadmin && auth.accessToken),
  });

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && grantingId === null) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, grantingId]);

  if (!isSuperadmin) return null;

  async function grant(id: string, label: string) {
    if (!auth.accessToken || !isSuperadmin) return;
    if (!window.confirm(`Разрешить пользователю ${label} публиковать истории как автору?`)) return;
    setError(null);
    setGrantingId(id);
    try {
      await grantAuthorRole(auth.accessToken, id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["authors"] }),
        queryClient.invalidateQueries({ queryKey: ["authors", "candidates"] }),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось выдать роль автора");
    } finally {
      setGrantingId(null);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={iconOnly ? "icon" : "default"}
        className={iconOnly
          ? "rounded-full text-white/76 hover:bg-violet-400/15 hover:text-violet-100"
          : "w-full justify-start rounded-2xl border border-violet-300/15 text-violet-100/80 hover:bg-violet-400/10 hover:text-violet-50"}
        onClick={() => setOpen(true)}
        aria-label="Управление авторами"
      >
        <UserRoundPlus className={iconOnly ? "size-5" : "mr-2 size-4"} />
        {!iconOnly ? "Авторы: доступ" : null}
      </Button>
      {open ? createPortal((
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="Управление авторами" className="w-full max-w-lg rounded-2xl border border-violet-300/20 bg-[#101a20] p-5 text-amber-50 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">Новые авторы</h2>
                <p className="mt-1 text-sm text-white/55">Здесь только зарегистрированные пользователи без роли автора. Доступ выдаётся вручную.</p>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Закрыть"><X className="size-5" /></Button>
            </div>
            {candidatesQuery.isLoading ? <p className="text-sm text-white/55">Загружаю пользователей…</p> : null}
            {candidatesQuery.isError ? <p role="alert" className="text-sm text-red-300">Не удалось загрузить список пользователей.</p> : null}
            {candidatesQuery.data?.items.length === 0 ? <p className="text-sm text-white/55">Пока нет пользователей, ожидающих доступа.</p> : null}
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
              {candidatesQuery.data?.items.map((candidate) => (
                <li key={candidate.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{candidate.name?.trim() || candidate.username}</p>
                    {candidate.name?.trim() ? <p className="truncate text-xs text-white/45">@{candidate.username}</p> : null}
                  </div>
                  <Button type="button" size="sm" disabled={grantingId !== null} onClick={() => void grant(candidate.id, candidate.username)} className="shrink-0 bg-violet-600 text-white hover:bg-violet-500">
                    {grantingId === candidate.id ? "Сохраняю…" : "Сделать автором"}
                  </Button>
                </li>
              ))}
            </ul>
            {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
          </section>
        </div>
      ), document.body) : null}
    </>
  );
}
