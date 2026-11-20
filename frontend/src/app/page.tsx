import { Suspense } from "react";
import { JournalPage } from "@/_pages/journal";

export default function Home() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Загрузка…</div>}>
      <JournalPage />
    </Suspense>
  );
}
