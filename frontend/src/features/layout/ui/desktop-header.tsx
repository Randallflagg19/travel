"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/entities/session/model/auth";
import { CloudinaryUploadButton } from "@/features/upload/ui/cloudinary-upload-button";
import { displayPlaceTitle } from "@/features/places/model/place-labels";

function useHeaderText() {
  const searchParams = useSearchParams();

  const country = searchParams.get("country") ?? "";
  const city = searchParams.get("city") ?? "";
  const unknown = searchParams.get("unknown") === "true";
  const all = searchParams.get("all") === "true";

  if (unknown) return { title: "Unknown", subtitle: "Посты без страны/города" };
  if (all) return { title: "Все посты", subtitle: "Общая лента" };
  if (country && city)
    return { title: displayPlaceTitle(country, city), subtitle: "Журнал" };
  return { title: "Tapir Travel", subtitle: "Личный журнал" };
}

export function DesktopHeader() {
  const { title, subtitle } = useHeaderText();
  const auth = useAuth();
  const displayName = auth.user?.name?.trim()
    ? auth.user.name.trim()
    : auth.user?.username ?? auth.user?.email ?? "";

  return (
    <div className="sticky top-0 z-40 hidden items-center gap-3 border-b border-white/10 bg-[#071014]/70 px-5 py-3 backdrop-blur-xl lg:flex">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{title}</div>
        <div className="truncate text-xs text-amber-100/55">{subtitle}</div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {auth.user ? (
          <>
            <div className="max-w-[260px] truncate text-xs text-white/55">
              {auth.user.role} · {displayName}
            </div>
            <CloudinaryUploadButton />
            <Button variant="ghost" size="sm" onClick={auth.logout} className="text-white/80">
              Выйти
            </Button>
          </>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/login" className="text-white/85">
              Войти
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
