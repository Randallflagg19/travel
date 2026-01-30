"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/entities/session/model/auth";
import { CloudinaryUploadButton } from "@/features/upload/ui/cloudinary-upload-button";

function useHeaderText() {
  const searchParams = useSearchParams();

  const country = searchParams.get("country") ?? "";
  const city = searchParams.get("city") ?? "";
  const unknown = searchParams.get("unknown") === "true";
  const all = searchParams.get("all") === "true";

  if (unknown) return { title: "Unknown", subtitle: "Посты без страны/города" };
  if (all) return { title: "Все посты", subtitle: "Общая лента" };
  if (country && city) return { title: `${country} / ${city}`, subtitle: "Лента" };
  return { title: "My Travels", subtitle: "Выбери страну и город" };
}

export function DesktopHeader() {
  const { title, subtitle } = useHeaderText();
  const auth = useAuth();
  const displayName = auth.user?.name?.trim()
    ? auth.user.name.trim()
    : auth.user?.username ?? auth.user?.email ?? "";

  return (
    <div className="supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 hidden items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur lg:flex">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="text-muted-foreground truncate text-xs">{subtitle}</div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {auth.user ? (
          <>
            <div className="text-muted-foreground max-w-[260px] truncate text-xs">
              {auth.user.role} · {displayName}
            </div>
            <CloudinaryUploadButton />
            <Button variant="ghost" size="sm" onClick={auth.logout}>
              Выйти
            </Button>
          </>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Войти</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

