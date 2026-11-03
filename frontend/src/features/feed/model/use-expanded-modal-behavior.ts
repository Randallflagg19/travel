"use client";

import { type RefObject, useEffect } from "react";
import { exitVideoFullscreen, isVideoFullscreen, setVideoVolume, toggleVideoMute } from "./video-element";

type ExpandedModalBehaviorOptions = {
  shortcutsEnabled: boolean;
  canMove: boolean;
  onMove: (direction: -1 | 1) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  shouldAutoPlayRef: RefObject<boolean>;
};

// Scroll locking lasts for the viewer's lifetime; shortcuts pause while reading the mobile sheet.
export function useExpandedModalBehavior({
  shortcutsEnabled,
  canMove,
  onMove,
  videoRef,
  shouldAutoPlayRef,
}: ExpandedModalBehaviorOptions): void {
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const root = document.documentElement;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      scrollbarGutter: root.style.scrollbarGutter,
    };
    // A fixed full-screen viewer must also cover the root's reserved scrollbar gutter.
    root.style.scrollbarGutter = "auto";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      root.style.scrollbarGutter = prev.scrollbarGutter;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    if (!shortcutsEnabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const video = videoRef.current;
      const fullscreen = isVideoFullscreen(video);
      if (event.key === "Escape" && fullscreen) {
        event.preventDefault();
        event.stopPropagation();
        void exitVideoFullscreen(video).catch(() => {});
        return;
      }

      const activeElement = document.activeElement;
      const target = event.target;
      const elements = [activeElement, target];
      if (elements.some((element) => element instanceof HTMLElement && (
        element.isContentEditable ||
        (element.closest("input, textarea, select, [role='textbox'], [role='slider']") &&
          !element.closest("[data-video-controls]"))
      ))) return;

      const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
      if (event.shiftKey && !horizontal) return;

      const space = event.code === "Space";
      // Space still activates a button reached with Tab (including Close and navigation).
      if (space && !fullscreen && elements.some((element) => element instanceof HTMLElement &&
        element.closest("button, a[href], [role='button']"))) return;

      const volume = event.key === "ArrowUp" || event.key === "ArrowDown";
      const mute = event.code === "KeyM" || event.key.toLowerCase() === "m";
      const navigate = horizontal && !event.shiftKey && !fullscreen;
      if (horizontal && event.shiftKey && !video) return;
      if (!navigate && (!video || !(horizontal || space || volume || mute))) return;

      // Also stop the native video controls from applying the same key a second time.
      event.preventDefault();
      event.stopPropagation();

      if (navigate) {
        if (canMove && !event.repeat) onMove(event.key === "ArrowRight" ? 1 : -1);
        return;
      }
      if (!video) return;
      shouldAutoPlayRef.current = false;

      if (space) {
        if (event.repeat) return;
        if (video.paused) void video.play().catch(() => {});
        else video.pause();
      } else if (mute) {
        if (!event.repeat) toggleVideoMute(video);
      } else if (volume) {
        const delta = event.key === "ArrowUp" ? 0.05 : -0.05;
        setVideoVolume(video, Math.round((video.volume + delta) * 100) / 100, event.key === "ArrowUp");
      } else if (Number.isFinite(video.duration)) {
        video.currentTime = Math.min(video.duration, Math.max(
          0, video.currentTime + (event.key === "ArrowRight" ? 5 : -5),
        ));
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [shortcutsEnabled, canMove, onMove, videoRef, shouldAutoPlayRef]);
}
