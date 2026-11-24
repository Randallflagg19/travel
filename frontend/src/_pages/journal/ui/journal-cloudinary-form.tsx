import { useState, type FormEvent } from "react";
import {
  AuthorCloudinarySaveError,
  type AuthorCloudinaryCredentials,
} from "@/shared/api/api";
import { Button } from "@/shared/ui/button";

const inputClassName =
  "mt-1.5 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-amber-50 disabled:opacity-60";

type JournalCloudinaryFormProps = {
  defaultCloudName: string;
  saving: boolean;
  onSave: (credentials: AuthorCloudinaryCredentials) => Promise<void>;
};

export function JournalCloudinaryForm({
  defaultCloudName,
  saving,
  onSave,
}: JournalCloudinaryFormProps) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const fields = new FormData(event.currentTarget);
    const cloudName = String(fields.get("cloudName") ?? "").trim();
    const apiKey = String(fields.get("apiKey") ?? "").trim();
    const apiSecret = String(fields.get("apiSecret") ?? "").trim();
    if (!cloudName || !apiKey || !apiSecret) {
      setError("Заполни Cloud name, API key и API secret.");
      return;
    }

    setError(null);
    try {
      await onSave({ cloudName, apiKey, apiSecret });
    } catch (error) {
      setError(
        error instanceof AuthorCloudinarySaveError && error.status === 400
          ? "Не удалось подтвердить данные. Проверь Cloud name, API key и API secret."
          : "Не удалось сохранить подключение Cloudinary. Попробуй ещё раз.",
      );
    }
  }

  return (
    <form
      method="post"
      autoComplete="off"
      className="mt-4 space-y-4"
      onSubmit={handleSubmit}
      aria-busy={saving}
    >
      <details className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm">
        <summary className="cursor-pointer font-medium">Где найти ключи?</summary>
        <p className="mt-2 text-amber-50/80">
          Войди в свой аккаунт Cloudinary или зарегистрируйся. На странице <strong>API Keys</strong> скопируй <strong>Cloud name</strong> вверху.
        </p>
        <p className="mt-2 text-amber-50/80">
          Если у тебя уже есть ключ для Travel, скопируй <strong>API key</strong> и <strong>API secret</strong> из одной строки. Иначе нажми <strong>Generate New API Key</strong> и создай ключ для Travel.
        </p>
        <div className="mt-3 rounded-md border border-white/15 bg-black/20 p-3 text-amber-50/80">
          <p className="font-medium">API Keys</p>
          <p className="mt-1">Cloud name <code className="ml-1 text-sky-300">example-travel</code></p>
        </div>
      </details>
      <a
        href="https://console.cloudinary.com/app/settings/api-keys"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-medium text-amber-200 underline underline-offset-4 hover:text-amber-100"
      >
        Открыть API Keys в Cloudinary
      </a>
      <label className="block text-sm text-amber-50/80">
        Cloud name
        <input
          name="cloudName"
          defaultValue={defaultCloudName}
          className={inputClassName}
          autoCapitalize="none"
          spellCheck={false}
          disabled={saving}
          required
        />
      </label>
      <label className="block text-sm text-amber-50/80">
        API key
        <input
          name="apiKey"
          className={inputClassName}
          autoCapitalize="none"
          spellCheck={false}
          disabled={saving}
          required
        />
      </label>
      <label className="block text-sm text-amber-50/80">
        API secret
        <input
          name="apiSecret"
          type="password"
          className={inputClassName}
          disabled={saving}
          required
        />
      </label>
      {error ? <p role="alert" className="text-sm text-red-200">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={saving}>
          {saving ? "Проверяем…" : "Проверить и сохранить"}
        </Button>
      </div>
    </form>
  );
}
