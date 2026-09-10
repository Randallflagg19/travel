"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/entities/session/model/auth";
import { createPost } from "@/shared/api/api";

export function StoryCreateButton({ iconOnly = false, className }: { iconOnly?: boolean; className?: string }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const canCreate = Boolean(auth.accessToken && (auth.user?.role === "ADMIN" || auth.user?.role === "SUPERADMIN"));

  async function save() {
    if (!auth.accessToken || !title.trim() || !text.trim()) return;
    setSaving(true);
    try {
      await createPost(auth.accessToken, {
        mediaType: "STORY",
        title: title.trim(),
        text: text.trim(),
        country: searchParams.get("country") || undefined,
        city: searchParams.get("city") || undefined,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["posts"] }),
        queryClient.invalidateQueries({ queryKey: ["places"] }),
      ]);
      setTitle(""); setText(""); setOpen(false);
    } finally { setSaving(false); }
  }

  if (!canCreate) return null;
  return <>
    <Button type="button" variant="ghost" size={iconOnly ? "icon" : "sm"} onClick={() => setOpen(true)} className={className} aria-label="Новая история">
      <BookOpen className="size-4" />{!iconOnly ? <span>История</span> : null}
    </Button>
    {open ? <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Новая история">
      <div className="w-full max-w-2xl rounded-2xl border border-amber-200/20 bg-[#102023] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-2xl text-amber-50">Новая история</h2><Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Закрыть"><X className="size-5" /></Button></div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Заголовок" className="mb-3 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-amber-50 placeholder:text-white/35" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={12000} placeholder="Расскажите, что произошло…" className="min-h-64 w-full resize-y rounded-lg border border-white/15 bg-black/20 px-3 py-2 leading-relaxed text-amber-50 placeholder:text-white/35" />
        <div className="mt-4 flex justify-end"><Button onClick={() => void save()} disabled={saving || !title.trim() || !text.trim()}>{saving ? "Сохраняю…" : "Опубликовать"}</Button></div>
      </div>
    </div> : null}
  </>;
}
