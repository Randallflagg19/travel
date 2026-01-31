"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  fetchComments,
  addComment,
  deleteComment,
  type ApiComment,
} from "@/shared/api/api";
import { Button } from "@/shared/ui/button";

type PostCommentsBlockProps = {
  postId: string;
  canComment: boolean;
  currentUserId: string | null;
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
  currentUserId,
  accessToken,
  onCommentAdded,
}: PostCommentsBlockProps) {
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState("");
  const [deleteConfirmCommentId, setDeleteConfirmCommentId] = useState<
    string | null
  >(null);
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

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) =>
      deleteComment(accessToken!, postId, commentId),
    onSuccess: (_, commentId) => {
      setDeleteConfirmCommentId(null);
      queryClient.setQueryData(
        ["comments", postId],
        (old: { items: ApiComment[] } | undefined) =>
          old
            ? {
                items: old.items.filter((c) => c.id !== commentId),
              }
            : old,
      );
      onCommentAdded?.();
    },
  });

  const items: ApiComment[] = commentsQuery.data?.items ?? [];
  const isLoading = commentsQuery.isLoading;
  const isSubmitting = addMutation.isPending;
  const canDeleteOwn = Boolean(accessToken && currentUserId);

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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words leading-snug">
                      {c.text}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatCommentDate(c.created_at)}
                    </p>
                  </div>
                  {canDeleteOwn && c.user_id === currentUserId ? (
                    <button
                      type="button"
                      onClick={() =>
                        !deleteMutation.isPending &&
                        setDeleteConfirmCommentId(c.id)
                      }
                      disabled={deleteMutation.isPending}
                      className="text-muted-foreground hover:text-destructive flex size-9 shrink-0 items-center justify-center rounded p-1 transition-colors disabled:opacity-50"
                      aria-label="Удалить комментарий"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
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

      {deleteConfirmCommentId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Подтверждение удаления"
          onClick={() => setDeleteConfirmCommentId(null)}
        >
          <div
            className="bg-background border-border w-full max-w-xs rounded-xl border p-4 shadow-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm">Удалить комментарий?</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-10 min-w-16 sm:min-h-9 sm:min-w-0"
                onClick={() => setDeleteConfirmCommentId(null)}
              >
                Отмена
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="min-h-10 min-w-20 sm:min-h-9 sm:min-w-0"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(deleteConfirmCommentId);
                }}
              >
                {deleteMutation.isPending ? "…" : "Удалить"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
