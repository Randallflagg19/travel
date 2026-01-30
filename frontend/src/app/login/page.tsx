"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { useAuth } from "@/entities/session/model/auth";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().trim().email("Неверный email"),
  password: z.string().min(3, "Пароль: минимум 3 символа"),
});

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const parsed = LoginSchema.safeParse({ email, password });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Проверь данные");
        return;
      }
      await auth.login({ email: parsed.data.email, password: parsed.data.password });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Вход</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1">
              <div className="text-sm font-medium">Email</div>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">Пароль</div>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••"
                required
              />
            </div>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <Button className="w-full" type="submit" disabled={submitting || auth.isLoading}>
              {submitting ? "Входим…" : "Войти"}
            </Button>

            <div className="text-muted-foreground text-center text-sm">
              Нет аккаунта?{" "}
              <Link className="text-foreground underline" href="/register">
                Регистрация
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

