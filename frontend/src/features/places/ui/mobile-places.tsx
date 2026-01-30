"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { Menu } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { PlacesSidebar } from "@/features/places/ui/places-sidebar";

export function MobilePlaces() {
  const [open, setOpen] = useState(false);
  const hasAutoOpened = useRef(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const country = searchParams.get("country") ?? "";
  const city = searchParams.get("city") ?? "";
  const unknown = searchParams.get("unknown") === "true";
  const all = searchParams.get("all") === "true";
  const isSelectionReady = all || unknown || (country && city);
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  // UX: on mobile, if nothing is selected, open the sheet by default (once).
  useEffect(() => {
    if (hasAutoOpened.current) return;
    if (isAuthRoute) return;
    if (isSelectionReady) return;
    hasAutoOpened.current = true;
    // Defer to next tick to avoid setState-in-effect lint rule / cascading render warning.
    const t = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(t);
  }, [isSelectionReady, isAuthRoute]);

  // Never show the places sheet on auth pages.
  if (isAuthRoute) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Открыть места">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[320px] p-0">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Места</SheetTitle>
        </SheetHeader>
        <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Загрузка…</div>}>
          <PlacesSidebar onNavigate={() => setOpen(false)} />
        </Suspense>
      </SheetContent>
    </Sheet>
  );
}

