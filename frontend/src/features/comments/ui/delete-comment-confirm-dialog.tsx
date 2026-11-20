import { Button } from "@/shared/ui/button";

export function DeleteCommentConfirmDialog({
  isDeleting,
  onCancel,
  onConfirm,
}: {
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Подтверждение удаления"
      onClick={onCancel}
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
            onClick={onCancel}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="min-h-10 min-w-20 sm:min-h-9 sm:min-w-0"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? "…" : "Удалить"}
          </Button>
        </div>
      </div>
    </div>
  );
}
