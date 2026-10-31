"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { BookMarked, ChevronLeft, ChevronRight, MapPin, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import type { ApiPost } from "@/shared/api/api";
import { cloudinaryVideoPosterUrl } from "@/shared/lib/cloudinary";
import { useExpandedModalBehavior } from "../model/use-expanded-modal-behavior";
import { ExpandedPhoto } from "./expanded-photo";
import { ExpandedPostDescription } from "./expanded-post-description";

type FeedExpandedModalProps = {
  post: ApiPost;
  onClose: () => void;
  expandedVideoSrc: string | null;
  previewSrc: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  shouldAutoPlayRef: RefObject<boolean>;
  onMove: (direction: -1 | 1) => void;
  canMove: boolean;
};

export function FeedExpandedModal({
  post: expandedPost,
  onClose,
  expandedVideoSrc,
  previewSrc,
  videoRef,
  shouldAutoPlayRef,
  onMove,
  canMove,
}: FeedExpandedModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [descriptionVisible, setDescriptionVisible] = useState(true);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const isStory = expandedPost.media_type === "STORY";
  const isVideo = expandedPost.media_type === "VIDEO";
  const hasDescription = Boolean(expandedPost.title || expandedPost.text);

  useExpandedModalBehavior({
    shortcutsEnabled: !isStory && !descriptionOpen,
    canMove,
    onMove,
    videoRef,
    shouldAutoPlayRef,
  });

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = () => { if (desktop.matches) setDescriptionOpen(false); };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  function onDescriptionOpenChange(open: boolean) {
    setDescriptionOpen(open);
    if (open) {
      shouldAutoPlayRef.current = false;
      videoRef.current?.pause();
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 w-screen bg-black/90" />
        <Dialog.Content
          ref={contentRef}
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex w-screen flex-col gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-amber-50 outline-none sm:p-5 lg:p-6"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (document.activeElement instanceof HTMLElement) openerRef.current = document.activeElement;
            contentRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus({ preventScroll: true });
          }}
        >
          <Dialog.Title className="sr-only">Просмотр медиа</Dialog.Title>
          {isStory ? (
            <div className="mx-auto flex h-full w-full max-w-xl items-center justify-center">
              <article
                className="relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-[#e7ddc9] text-[#33291f] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="z-20 flex shrink-0 items-center justify-between border-b border-[#796752]/20 bg-[#e7ddc9] px-6 py-4">
                  <div className="flex items-center gap-4 text-[#594837]">
                    <span className="inline-flex items-center gap-1.5 font-story-body text-sm font-medium">
                      <BookMarked className="size-[18px]" strokeWidth={1.8} />
                      История
                    </span>
                    {expandedPost.city?.trim() || expandedPost.country?.trim() ? (
                      <span className="inline-flex items-center gap-1.5 font-story-body text-sm font-medium">
                        <MapPin className="size-[18px]" strokeWidth={1.8} />
                        {expandedPost.city?.trim() || expandedPost.country?.trim()}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Закрыть историю"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#594837] transition hover:bg-[#d5c8ae]/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#594837]"
                    onClick={onClose}
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div className="story-reader-scroll min-h-0 flex-1 overflow-y-auto">
                  <div className="relative px-6 pt-10 pb-28">
                    <h2 className="font-story text-4xl leading-[0.98] sm:text-5xl">
                      {expandedPost.title}
                    </h2>
                    <p className="mt-7 whitespace-pre-line font-story-body text-base leading-8 text-[#493a2d]">
                      {expandedPost.text}
                    </p>
                  </div>
                </div>
              </article>
            </div>
          ) : (
            <>
              <header className="flex min-h-11 shrink-0 items-center justify-between gap-3">
                <span className="text-sm text-amber-50/65">{isVideo ? "Видео" : "Фото"}</span>
                <div className="flex items-center gap-3">
                  {hasDescription ? (
                    <button
                      type="button"
                      aria-expanded={descriptionVisible}
                      aria-label={descriptionVisible ? "Скрыть описание" : "Показать описание"}
                      className="hidden min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-amber-50/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white lg:flex"
                      onClick={() => setDescriptionVisible((visible) => !visible)}
                    >
                      {descriptionVisible ? <PanelRightClose className="size-5" /> : <PanelRightOpen className="size-5" />}
                      {descriptionVisible ? "Скрыть описание" : "Показать описание"}
                    </button>
                  ) : null}
                  <Dialog.Close asChild>
                    <button type="button" aria-label="Закрыть просмотр" className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/40 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                      <X className="size-6" aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </div>
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-5">
                <div
                  aria-label="Медиа"
                  className="relative min-h-0 min-w-0 flex-1"
                  onTouchStart={(event) => {
                    touchStartRef.current = null;
                    if (!canMove || event.touches.length !== 1) return;
                    if (event.target instanceof Element && event.target.closest("button:not([data-media-surface])")) return;
                    const touch = event.touches[0];
                    // Native controls retarget touch events to <video>; reserve their lower area.
                    if (isVideo && touch.clientY > event.currentTarget.getBoundingClientRect().bottom - 96) return;
                    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
                  }}
                  onTouchMove={(event) => {
                    if (event.touches.length !== 1) touchStartRef.current = null;
                  }}
                  onTouchCancel={() => { touchStartRef.current = null; }}
                  onTouchEnd={(event) => {
                    const start = touchStartRef.current;
                    touchStartRef.current = null;
                    if (!start || event.changedTouches.length !== 1) return;
                    const touch = event.changedTouches[0];
                    const dx = touch.clientX - start.x;
                    const dy = touch.clientY - start.y;
                    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 2) {
                      event.preventDefault();
                      onMove(dx < 0 ? 1 : -1);
                    }
                  }}
                >
                  {isVideo ? (
                    <video
                      key={expandedPost.id}
                      ref={videoRef}
                      className="h-full w-full rounded-lg bg-black object-contain outline-none"
                      controls
                      playsInline
                      preload="auto"
                      src={expandedVideoSrc || undefined}
                      poster={expandedPost.cloudinary_public_id
                        ? (cloudinaryVideoPosterUrl(expandedPost.media_url ?? "", expandedPost.cloudinary_public_id, { width: 1200 }) ?? undefined)
                        : undefined}
                      onCanPlay={() => {
                        if (shouldAutoPlayRef.current) {
                          shouldAutoPlayRef.current = false;
                          void videoRef.current?.play().catch(() => {});
                        }
                      }}
                    />
                  ) : (
                    <ExpandedPhoto
                      key={`${expandedPost.id}:${expandedPost.media_url}`}
                      post={expandedPost}
                      previewSrc={previewSrc}
                      onClose={onClose}
                    />
                  )}
                  {canMove ? (
                    <>
                      <button
                        type="button"
                        aria-label="Предыдущее фото или видео"
                        title="Предыдущий пост"
                        aria-keyshortcuts="ArrowLeft"
                        className="absolute top-1/2 left-1 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white sm:left-3"
                        onClick={() => onMove(-1)}
                      >
                        <ChevronLeft />
                      </button>
                      <button
                        type="button"
                        aria-label="Следующее фото или видео"
                        title="Следующий пост"
                        aria-keyshortcuts="ArrowRight"
                        className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white sm:right-3"
                        onClick={() => onMove(1)}
                      >
                        <ChevronRight />
                      </button>
                    </>
                  ) : null}
                </div>
                <ExpandedPostDescription
                  post={expandedPost}
                  desktopVisible={descriptionVisible}
                  sheetOpen={descriptionOpen}
                  onSheetOpenChange={onDescriptionOpenChange}
                />
              </div>
              {isVideo ? (
                <p className="hidden shrink-0 text-center text-xs leading-relaxed text-amber-50/60 lg:block">
                  Shift + ← → — перемотка 5 с · Пробел — пауза · ↑ ↓ — громкость · M — звук
                </p>
              ) : null}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
