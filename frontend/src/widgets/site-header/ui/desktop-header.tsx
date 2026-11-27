"use client";

import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { useJournalNavigation } from "@/features/journal-navigation";
import { useAuth } from "@/entities/session";
import {
  CloudinaryUploadButton,
  StoryCreateButton,
} from "@/features/create-post";

export function DesktopHeader() {
  const auth = useAuth();
  const { author, isAuthorReady, selectedCountry, selectedCity, selectedAlbumId } =
    useJournalNavigation();
  const publicationContext = {
    authorId: author?.id ?? null,
    ready: isAuthorReady,
    country: selectedCountry,
    city: selectedCity,
    albumId: selectedAlbumId || undefined,
  };
  const displayName = auth.user?.name?.trim()
    ? auth.user.name.trim()
    : (auth.user?.username ?? auth.user?.email ?? "");

  return (
    <div className="fixed right-5 top-4 z-40 hidden items-center gap-1.5 rounded-full border border-amber-100/10 bg-[#071014]/38 p-1 shadow-lg shadow-black/20 backdrop-blur-xl lg:flex">
      {auth.user ? (
        <>
          <div className="max-w-[180px] truncate rounded-full px-3 py-1.5 text-xs text-white/52">
            {displayName}
          </div>
          <CloudinaryUploadButton
            journal={publicationContext}
            variant="ghost"
            className="h-8 rounded-full px-3 text-sm font-medium text-amber-50/78 hover:bg-white/[0.06] hover:text-amber-50"
          />
          <StoryCreateButton
            journal={publicationContext}
            className="h-8 rounded-full px-3 text-sm font-medium text-amber-50/78 hover:bg-white/[0.06] hover:text-amber-50"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={auth.logout}
            className="h-8 rounded-full px-3 text-sm text-white/58 hover:bg-white/[0.06] hover:text-amber-50"
          >
            Выйти
          </Button>
        </>
      ) : (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 rounded-full px-3 text-sm text-white/58 hover:bg-white/[0.06] hover:text-amber-50"
        >
          <Link href="/login">Войти</Link>
        </Button>
      )}
    </div>
  );
}
