import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import type { ApiPost } from "@/shared/api/api";
import type { ExpandedPhotoImage } from "../model/use-expanded-media-images";

type ExpandedPhotoProps = {
  post: ApiPost;
  image: ExpandedPhotoImage;
  onClose: () => void;
};

export function ExpandedPhoto({ post, image, onClose }: ExpandedPhotoProps) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg" aria-busy={image.status === "loading"}>
      <button type="button" data-media-surface className="relative h-full w-full cursor-zoom-out" onClick={onClose} aria-label="Закрыть">
        {image.src ? (
          <Image
            alt={post.title ?? post.text ?? "travel media"}
            src={image.src}
            fill
            className="object-contain"
            unoptimized
          />
        ) : image.status === "loading" ? (
          <LoaderCircle className="mx-auto size-6 animate-spin text-[#83c8b6]" aria-label="Загружаем фото" />
        ) : null}
      </button>
      {image.status === "error" ? (
        <div role="alert" className="absolute inset-x-4 top-4 flex flex-wrap items-center justify-center gap-3 rounded-lg bg-black/75 p-3 text-sm text-amber-50" onClick={(event) => event.stopPropagation()}>
          <span>Не удалось загрузить фото в большем размере</span>
          <button type="button" className="cursor-pointer rounded-md border border-white/30 px-3 py-2 hover:bg-white/10" onClick={image.retry}>
            Повторить
          </button>
        </div>
      ) : null}
    </div>
  );
}
