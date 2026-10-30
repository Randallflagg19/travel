import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import type { ApiPost } from "@/shared/api/api";
import { cloudinaryPhotoSources } from "@/shared/lib/cloudinary";

type ExpandedPhotoProps = {
  post: ApiPost;
  previewSrc: string | null;
  onClose: () => void;
};

export function ExpandedPhoto({ post, previewSrc, onClose }: ExpandedPhotoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState(previewSrc);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    let request = 0;
    let requestedSrc = "";
    let readySrc = previewSrc;
    let readyWidth = 0;
    // The preview is already cached; its dimensions also cover older posts without metadata.
    const preview = new window.Image();
    if (previewSrc) preview.src = previewSrc;

    const load = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      if (previewSrc && !preview.complete) return;
      const ratio = post.media_width && post.media_height
        ? post.media_width / post.media_height
        : preview.naturalWidth / preview.naturalHeight;
      const displayWidth = ratio > 0 ? Math.min(width, height * ratio) : width;
      const targetWidth = Math.ceil(displayWidth * window.devicePixelRatio);
      if (preview.naturalWidth > readyWidth) {
        readySrc = previewSrc;
        readyWidth = preview.naturalWidth;
      }
      if (readySrc && readyWidth >= targetWidth) {
        ++request;
        requestedSrc = readySrc;
        setSrc(readySrc);
        setStatus("loaded");
        return;
      }
      const nextSrc = cloudinaryPhotoSources(post.media_url ?? "", post.media_width, targetWidth).src;
      if (nextSrc === requestedSrc) return;
      requestedSrc = nextSrc;
      const currentRequest = ++request;
      setStatus("loading");
      const image = new window.Image();
      image.src = nextSrc;
      void image.decode().then(() => {
        if (!active || currentRequest !== request) return;
        readySrc = nextSrc;
        readyWidth = image.naturalWidth;
        setSrc(nextSrc);
        setStatus("loaded");
      }).catch(() => {
        if (active && currentRequest === request) setStatus("error");
      });
    };

    const observer = new ResizeObserver(load);
    observer.observe(container);
    // Recalculate when rotating/moving a window to a screen with another pixel density.
    window.addEventListener("resize", load);
    preview.onload = load;
    preview.onerror = load;
    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener("resize", load);
      preview.onload = null;
      preview.onerror = null;
    };
  }, [post.media_url, post.media_width, post.media_height, previewSrc, attempt]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-lg" aria-busy={status === "loading"}>
      <button type="button" className="relative h-full w-full cursor-zoom-out" onClick={onClose} aria-label="Закрыть">
        {src ? (
          <Image
            alt={post.title ?? post.text ?? "travel media"}
            src={src}
            fill
            className="object-contain"
            unoptimized
          />
        ) : status === "loading" ? (
          <LoaderCircle className="mx-auto size-6 animate-spin text-[#83c8b6]" aria-label="Загружаем фото" />
        ) : null}
      </button>
      {status === "error" ? (
        <div role="alert" className="absolute inset-x-4 top-4 flex flex-wrap items-center justify-center gap-3 rounded-lg bg-black/75 p-3 text-sm text-amber-50" onClick={(event) => event.stopPropagation()}>
          <span>Не удалось загрузить фото в большем размере</span>
          <button type="button" className="cursor-pointer rounded-md border border-white/30 px-3 py-2 hover:bg-white/10" onClick={() => setAttempt((current) => current + 1)}>
            Повторить
          </button>
        </div>
      ) : null}
    </div>
  );
}
