import { Folder } from "lucide-react";
import type { ApiAlbum } from "@/shared/api/api";
import { Button } from "@/shared/ui/button";
import { JournalCreateAlbum } from "./journal-create-album";

export function JournalAlbums({
  country,
  accessToken,
  albums,
  selectedAlbumId,
  isPending,
  isError,
  onSelect,
  onCreated,
}: {
  country: string;
  accessToken: string | null;
  albums: ApiAlbum[];
  selectedAlbumId: string;
  isPending: boolean;
  isError: boolean;
  onSelect: (albumId: string) => void;
  onCreated: () => void;
}) {
  const hasChips = albums.length > 0 || Boolean(accessToken);
  const showStatus = !selectedAlbumId;

  if (!hasChips && !(showStatus && (isPending || isError))) return null;

  return (
    <div className="grid gap-1.5 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <span id="journal-albums-label" className="text-sm text-amber-50/67 sm:pt-2">
        Альбомы
      </span>
      <div className="min-w-0 space-y-1.5">
        {hasChips ? (
          <ul aria-labelledby="journal-albums-label" className="flex flex-wrap items-center gap-1.5">
            {albums.map((album) => (
              <li key={album.id} className="max-w-full min-w-0">
                <Button
                  type="button"
                  variant="ghost"
                  aria-pressed={selectedAlbumId === album.id}
                  onClick={() => onSelect(album.id)}
                  className="group h-auto min-h-11 max-w-full gap-1.5 rounded-full border border-amber-100/15 bg-[#071014]/60 px-3 py-1.5 text-amber-50/88 whitespace-normal hover:border-emerald-200/35 hover:bg-emerald-200/10 hover:text-amber-50 aria-pressed:border-emerald-100/65 aria-pressed:bg-emerald-100 aria-pressed:text-emerald-950 lg:min-h-9"
                >
                  <Folder aria-hidden="true" className="size-3.5 shrink-0 text-emerald-200/75 group-aria-pressed:text-emerald-800" />
                  <span className="min-w-0 wrap-anywhere">{album.title}</span>
                </Button>
              </li>
            ))}
            {accessToken ? (
              <li>
                <JournalCreateAlbum
                  accessToken={accessToken}
                  country={country}
                  onCreated={onCreated}
                />
              </li>
            ) : null}
          </ul>
        ) : null}
        {showStatus && isPending ? (
          <p role="status" className="text-sm text-amber-50/65">
            Загружаем альбомы…
          </p>
        ) : null}
        {showStatus && isError ? (
          <p role="alert" className="text-sm text-red-200">
            Не удалось загрузить альбомы.
          </p>
        ) : null}
      </div>
    </div>
  );
}
