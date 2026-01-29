"use client";

import { useState, Suspense } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PlacesSidebar } from "@/components/places-sidebar";

export function MobilePlaces() {
  const [open, setOpen] = useState(false);

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

