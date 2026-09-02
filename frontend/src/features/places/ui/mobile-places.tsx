"use client";

import { useState, Suspense } from "react";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { PlacesSidebar } from "@/features/places/ui/places-sidebar";

export function MobilePlaces() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isAuthRoute = pathname === "/login" || pathname === "/register";

  // Never show the places sheet on auth pages.
  if (isAuthRoute) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Открыть места">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[340px] max-w-[92vw] p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Места</SheetTitle>
        </SheetHeader>
        <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Загрузка…</div>}>
          <PlacesSidebar onNavigate={() => setOpen(false)} />
        </Suspense>
      </SheetContent>
    </Sheet>
  );
}
