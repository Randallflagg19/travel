"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchComments, addComment, type ApiComment } from "@/shared/api/api";
import { Button } from "@/shared/ui/button";

type PostCommentsBlockProps = {
  postId: string;
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

export function PostCommentsBlock({
  postId,
  canComment,
  accessToken,
  onCommentAdded,
}: PostCommentsBlockProps) {
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const commentsQuery = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => fetchComments(postId),
    enabled: Boolean(postId),
  });

  const addMutation = useMutation({
    mutationFn: (text: string) => addComment(accessToken!, postId, text),
    onSuccess: (data) => {
      setNewText("");
      queryClient.setQueryData(
        ["comments", postId],
        (old: { items: ApiComment[] } | undefined) => ({
          items: [...(old?.items ?? []), data.comment],
        }),
      );
      onCommentAdded?.();
      requestAnimationFrame(() => {
        const el = listRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    },
  });

  const items: ApiComment[] = commentsQuery.data?.items ?? [];
  const isLoading = commentsQuery.isLoading;
  const isSubmitting = addMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newText.trim();
    if (!canComment || !accessToken || !trimmed || isSubmitting) return;
    addMutation.mutate(trimmed);
  }

  return (
    <div className="border-t pt-3">
      <div
        ref={listRef}
        className="max-h-[280px] overflow-y-auto overscroll-contain rounded-lg bg-muted/30 py-1"
      >
        {isLoading ? (
          <p className="text-muted-foreground px-2 py-4 text-center text-sm">
            Загрузка…
          </p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground px-2 py-4 text-center text-sm">
            Пока нет комментариев
          </p>
        ) : (
          <ul className="space-y-2 px-2 pb-2">
            {items.map((c) => (
              <li
                key={c.id}
                className="rounded-lg bg-muted/50 px-3 py-2 text-sm"
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

      {canComment && accessToken ? (
        <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Написать комментарий…"
            rows={1}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[38px] max-h-20 flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
            disabled={isSubmitting}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newText.trim() || isSubmitting}
            className="shrink-0 self-end rounded-lg"
          >
            {isSubmitting ? "…" : "Отправить"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
