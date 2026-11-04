/* eslint-disable @next/next/no-img-element -- small Cloudinary variants and video posters */
"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Music2, Play } from "lucide-react";
import type { ApiPostMedia } from "@/shared/api/api";
import { cloudinaryPhotoSources, cloudinaryVideoPosterUrl } from "@/shared/lib/cloudinary";

type PostMediaThumbnailsProps = {
  media: ApiPostMedia[];
  activeIndex: number;
  onSelect: (attachmentId: string) => void;
  variant?: "card" | "viewer";
};

export function PostMediaThumbnails({ media, activeIndex, onSelect, variant = "card" }: PostMediaThumbnailsProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!strip || !active) return;
    const bounds = strip.getBoundingClientRect();
    const selected = active.getBoundingClientRect();
    const delta = selected.left < bounds.left + 8 ? selected.left - bounds.left - 8
      : selected.right > bounds.right - 8 ? selected.right - bounds.right + 8 : 0;
    // Scroll only this strip; changing frames must not move the page vertically.
    if (delta) strip.scrollBy({ left: delta, behavior: "smooth" });
  }, [activeIndex, media]);

  if (media.length < 2) return null;

  return (
    <div ref={stripRef} role="group" aria-label="Миниатюры публикации" data-carousel-thumbnails
      className={`flex min-w-0 shrink-0 gap-2 overflow-x-auto overscroll-x-contain p-2 [scrollbar-width:thin] ${variant === "card" ? "border-t border-white/10 bg-black/15" : "rounded-xl bg-black/25"}`}>
      {media.map((item, index) => (
        <MediaThumbnail key={item.id} media={item} index={index} selected={index === activeIndex} variant={variant}
          onSelect={() => { if (index !== activeIndex) onSelect(item.id); }} />
      ))}
    </div>
  );
}

function MediaThumbnail({ media, index, selected, variant, onSelect }: {
  media: ApiPostMedia; index: number; selected: boolean; variant: "card" | "viewer"; onSelect: () => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const video = media.media_type === "VIDEO";
  const label = media.media_type === "PHOTO" ? "фото" : video ? "видео" : "аудио";
  const src = video ? cloudinaryVideoPosterUrl(media.media_url, media.cloudinary_public_id ?? "", { width: 160 })
    : media.media_type === "PHOTO" ? cloudinaryPhotoSources(media.media_url, media.media_width, 160).src : null;

  return (
    <button type="button" aria-label={`Показать кадр ${index + 1}: ${label}`} aria-pressed={selected} onClick={onSelect}
      className={`relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 bg-[#152528] text-amber-50 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${variant === "viewer" ? "size-16 sm:size-20" : "size-14"} ${selected ? "border-amber-200 ring-1 ring-amber-200/60" : "border-white/15 opacity-70 hover:border-white/45 hover:opacity-100"}`}>
      {src && failedSrc !== src ? <img src={src} alt="" width={160} height={160} loading="lazy" decoding="async" draggable={false}
        className="h-full w-full object-cover" onError={() => setFailedSrc(src)} />
        : media.media_type === "AUDIO" ? <Music2 className="size-5" aria-hidden="true" />
          : !video ? <ImageIcon className="size-5 text-amber-50/45" aria-hidden="true" /> : null}
      {video ? <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-black/65 p-1.5"><Play className="size-3 fill-current" aria-hidden="true" /></span></span> : null}
    </button>
  );
}
