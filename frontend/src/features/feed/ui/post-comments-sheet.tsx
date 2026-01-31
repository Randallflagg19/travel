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
        side="right"
        className="flex w-full flex-col sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            Комментарии {postCommentCount > 0 ? `(${postCommentCount})` : ""}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-1">
          {isLoading ? (
            <p className="text-muted-foreground py-4 text-sm">
              Загрузка комментариев…
            </p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              Пока нет комментариев.
            </p>
          ) : (
            <ul className="space-y-3 py-2">
              {items.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border bg-muted/50 px-3 py-2 text-sm"
                >
                  <p className="whitespace-pre-wrap break-words">{c.text}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {formatCommentDate(c.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {canComment && accessToken && postId ? (
          <form
            onSubmit={handleSubmit}
            className="mt-4 flex flex-col gap-2 border-t pt-4"
          >
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Написать комментарий…"
              rows={2}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            />
            <Button type="submit" disabled={!newText.trim() || isSubmitting}>
              {isSubmitting ? "Отправка…" : "Отправить"}
            </Button>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
