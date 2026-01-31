"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { fetchComments, addComment, type ApiComment } from "@/shared/api/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";

type PostCommentsSheetProps = {
  postId: string | null;
  postCommentCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canComment: boolean;
  accessToken: string | null;
  onCommentAdded?: () => void;
};

function formatCommentDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PostCommentsSheet({
  postId,
  postCommentCount,
  open,
  onOpenChange,
  canComment,
  accessToken,
  onCommentAdded,
}: PostCommentsSheetProps) {
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState("");

  const commentsQuery = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => fetchComments(postId!),
    enabled: Boolean(open && postId),
  });

  const addMutation = useMutation({
    mutationFn: (text: string) =>
      addComment(accessToken!, postId!, text),
    onSuccess: () => {
      setNewText("");
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      onCommentAdded?.();
    },
  });

  const items: ApiComment[] = commentsQuery.data?.items ?? [];
  const isLoading = commentsQuery.isLoading;
  const isSubmitting = addMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newText.trim();
    if (!canComment || !accessToken || !postId || !trimmed || isSubmitting)
      return;
    addMutation.mutate(trimmed);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onClose={() => onOpenChange(false)}
        className="flex max-h-[70vh] w-full flex-col gap-0 overflow-hidden rounded-t-2xl px-0 sm:left-1/2 sm:right-auto sm:max-w-md sm:-translate-x-1/2"
      >
        {/* Фиксированная шапка */}
        <SheetHeader className="shrink-0 border-b px-4 py-3 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-5 shrink-0 text-muted-foreground" />
            <span>Комментарии{postCommentCount > 0 ? ` · ${postCommentCount}` : ""}</span>
          </SheetTitle>
        </SheetHeader>

        {/* Только список скроллится, инпут всегда внизу */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-4 pb-4 pt-2">
              {isLoading ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Загрузка…
                </p>
              ) : items.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Пока нет комментариев
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-xl bg-muted/40 px-3 py-2.5 text-sm"
                    >
                      <p className="whitespace-pre-wrap break-words leading-snug">
                        {c.text}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatCommentDate(c.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Фиксированная форма внизу, не перекрывается списком */}
        {canComment && accessToken && postId ? (
          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t bg-muted/20 px-4 py-3"
          >
            <div className="flex gap-2">
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Написать комментарий…"
                rows={1}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[40px] max-h-24 flex-1 resize-none rounded-xl border px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
                disabled={isSubmitting}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newText.trim() || isSubmitting}
                className="shrink-0 self-end rounded-xl"
              >
                {isSubmitting ? "…" : "Отправить"}
              </Button>
            </div>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
