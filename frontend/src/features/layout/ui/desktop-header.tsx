"use client";

import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/entities/session/model/auth";
import { CloudinaryUploadButton } from "@/features/upload/ui/cloudinary-upload-button";

export function DesktopHeader() {
  const auth = useAuth();
  const displayName = auth.user?.name?.trim()
    ? auth.user.name.trim()
    : auth.user?.username ?? auth.user?.email ?? "";

  return (
    <div className="fixed right-5 top-4 z-40 hidden items-center gap-2 lg:flex">
      {auth.user ? (
        <>
          <div className="max-w-[220px] truncate rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/55 backdrop-blur-xl">
            {displayName}
          </div>
          <CloudinaryUploadButton />
          <Button
            variant="ghost"
            size="sm"
            onClick={auth.logout}
            className="rounded-full bg-black/20 text-white/75 backdrop-blur-xl hover:bg-white/10 hover:text-white"
          >
            Выйти
          </Button>
        </>
      ) : (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="rounded-full bg-black/20 text-white/75 backdrop-blur-xl hover:bg-white/10 hover:text-white"
        >
          <Link href="/login">Войти</Link>
        </Button>
      )}
    </div>
  );
}
