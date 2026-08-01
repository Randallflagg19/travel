"use client";

import Link from "next/link";
import { MobilePlaces } from "@/features/places/ui/mobile-places";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/entities/session/model/auth";
import { CloudinaryUploadButton } from "@/features/upload/ui/cloudinary-upload-button";

export function MobileHeader() {
  const auth = useAuth();

  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 border-b border-white/10 bg-[#071014]/80 px-3 py-2 backdrop-blur-xl lg:hidden">
      <MobilePlaces />
      <div className="ml-auto flex items-center gap-2">
        {auth.user ? (
          <>
            <CloudinaryUploadButton size="sm" variant="secondary" />
            <Button
              variant="ghost"
              size="sm"
              onClick={auth.logout}
              className="text-white/75 hover:bg-white/10 hover:text-white"
            >
              Выйти
            </Button>
          </>
        ) : (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-white/75 hover:bg-white/10 hover:text-white"
          >
            <Link href="/login">Войти</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
