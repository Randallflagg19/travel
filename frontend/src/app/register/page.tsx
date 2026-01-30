"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { useAuth } from "@/entities/session/model/auth";
import { z } from "zod";

const RegisterSchema = z.object({
  name: z.string().optional(),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{3,32}$/, "Username: 3–32, латиница/цифры и . _ -"),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Неверный email"),
  password: z.string().min(3, "Пароль: минимум 3 символа"),
});

export default function RegisterPage() {
  const router = useRouter();
  const auth = useAuth();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const parsed = RegisterSchema.safeParse({ name, username, email, password });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Проверь данные");
        return;
      }

      await auth.register({
        username: parsed.data.username,
        password: parsed.data.password,
        email: parsed.data.email?.trim() ? parsed.data.email.trim() : undefined,
        name: parsed.data.name?.trim() ? parsed.data.name.trim() : undefined,
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось зарегистрироваться");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Регистрация</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1">
              <div className="text-sm font-medium">Username</div>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tapir"
                required
              />
              <div className="text-muted-foreground text-xs">3–32, латиница/цифры и . _ -</div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">Имя (опционально)</div>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tapir"
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">Email (опционально)</div>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">Пароль</div>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                autoComplete="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="минимум 3 символа"
                required
              />
            </div>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <Button className="w-full" type="submit" disabled={submitting || auth.isLoading}>
              {submitting ? "Создаём…" : "Создать аккаунт"}
            </Button>

            <div className="text-muted-foreground text-center text-sm">
              Уже есть аккаунт?{" "}
              <Link className="text-foreground underline" href="/login">
                Войти
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

