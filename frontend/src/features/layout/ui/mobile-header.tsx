"use client";

import Image from "next/image";
import Link from "next/link";
import { LogIn, LogOut, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/entities/session/model/auth";
import { CloudinaryUploadButton } from "@/features/upload/ui/cloudinary-upload-button";
import { StoryCreateButton } from "@/features/upload/ui/story-create-button";

export function MobileHeader() {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deleteMode = searchParams.get("delete") === "1";
  const canDelete = Boolean(
    pathname === "/" &&
      auth.user &&
      (auth.user.role === "ADMIN" || auth.user.role === "SUPERADMIN"),
  );

  function toggleDeleteMode() {
    const next = new URLSearchParams(searchParams.toString());
    if (deleteMode) next.delete("delete");
    else next.set("delete", "1");
    const query = next.toString();
    router.push(query ? `/?${query}` : "/");
  }

  return (
    <div className="sticky top-0 z-50 grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-white/10 bg-[#071014]/88 px-4 backdrop-blur-xl lg:hidden">
      <div className="justify-self-start">
        {canDelete ? (
          <Button
            variant={deleteMode ? "destructive" : "ghost"}
            size="icon"
            onClick={toggleDeleteMode}
            className="rounded-full text-white/76 hover:bg-white/10 hover:text-white data-[variant=destructive]:hover:bg-destructive/90"
            aria-label={deleteMode ? "Выключить удаление" : "Включить удаление"}
            aria-pressed={deleteMode}
          >
            <Trash2 className="size-5" />
          </Button>
        ) : null}
      </div>

      <Link
        href="/"
        className="relative size-12 overflow-hidden rounded-2xl"
        aria-label="Tapir Travel"
      >
        <Image
          src="/first-screen/sidebar/tapir-mascot-dark-bg.png"
          alt="Tapir Travel"
          fill
          priority
          className="object-contain"
          sizes="48px"
        />
      </Link>

      <div className="flex items-center gap-1.5 justify-self-end">
        {auth.user ? (
          <>
            <CloudinaryUploadButton
              size="icon"
              variant="ghost"
              iconOnly
              className="rounded-full text-white/76 hover:bg-white/10 hover:text-white"
            />
            <StoryCreateButton iconOnly className="rounded-full text-white/76 hover:bg-white/10 hover:text-white" />
            <Button
              variant="ghost"
              size="icon"
              onClick={auth.logout}
              className="rounded-full text-white/76 hover:bg-white/10 hover:text-white"
              aria-label="Выйти"
            >
              <LogOut className="size-5" />
            </Button>
          </>
        ) : (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="rounded-full text-white/76 hover:bg-white/10 hover:text-white"
          >
            <Link href="/login" aria-label="Войти">
              <LogIn className="size-5" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
