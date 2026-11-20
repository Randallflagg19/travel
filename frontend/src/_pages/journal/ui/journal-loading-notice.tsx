import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

type FeedServerLoadingNoticeProps = {
  isPlacesLoading: boolean;
  isPostsLoading: boolean;
};

export function FeedServerLoadingNotice({
  isPlacesLoading,
  isPostsLoading,
}: FeedServerLoadingNoticeProps) {
  if (!isPlacesLoading && !isPostsLoading) return null;

  const title =
    isPlacesLoading && isPostsLoading
      ? "Загружаем маршрут и первые кадры"
      : isPlacesLoading
        ? "Загружаем маршрут"
        : "Загружаем первые кадры";

  return (
    <Card className="travel-glass border-emerald-200/15 bg-emerald-200/[0.055]">
      <CardHeader className="flex flex-row items-center gap-4 space-y-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-300/12 ring-1 ring-emerald-200/20">
          <span className="size-2.5 animate-pulse rounded-full bg-emerald-200" />
        </div>
        <div>
          <CardTitle className="text-base text-white">{title}</CardTitle>
          <CardDescription className="mt-1 text-white/55">
            Подключаемся к серверу. После паузы это может занять больше времени.
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}
