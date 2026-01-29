import { Suspense } from "react";
import { Feed } from "@/components/feed";

export default function Home() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Загрузка…</div>}>
      <Feed />
    </Suspense>
  );
}
