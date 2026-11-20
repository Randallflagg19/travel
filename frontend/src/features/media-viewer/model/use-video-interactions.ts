import {
  type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject,
  useCallback, useEffect, useRef, useState,
} from "react";
import { exitVideoFullscreen, isVideoFullscreen } from "./video-element";
import type { VideoPlaybackState } from "./use-video-playback";

type VideoInteractionsOptions = {
  videoRef: RefObject<HTMLVideoElement | null>;
  playback: VideoPlaybackState;
  notice: string | null;
  onNotice: (message: string | null) => void;
  onTogglePlayback: () => void;
  onCancelPendingNavigation: () => void;
};
type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };
const CONTROLS_HIDE_DELAY_MS = 2500;
const SINGLE_CLICK_DELAY_MS = 300;

export function useVideoInteractions({
  videoRef, playback, notice, onNotice, onTogglePlayback, onCancelPendingNavigation,
}: VideoInteractionsOptions) {
  const frameRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickPlaybackRef = useRef<{ paused: boolean; time: number; applied: boolean } | null>(null);
  const pointerOverControlsRef = useRef(false);
  const draggingRef = useRef(false);
  const keyboardFocusRef = useRef(false);
  const pointerTypeRef = useRef("mouse");

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      const video = videoRef.current;
      const focused = keyboardFocusRef.current && controlsRef.current?.contains(document.activeElement);
      if (video && isVideoFullscreen(video) && !video.paused && video.readyState >= 3 &&
          !pointerOverControlsRef.current && !draggingRef.current && !focused) {
        setControlsVisible(false);
      }
    }, CONTROLS_HIDE_DELAY_MS);
  }, [videoRef]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    function endDrag() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      scheduleHide();
    }
    // Release can happen outside the panel, or the window can lose focus mid-drag.
    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);
    window.addEventListener("blur", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag, true);
      window.removeEventListener("pointercancel", endDrag, true);
      window.removeEventListener("blur", endDrag);
    };
  }, [scheduleHide]);

  useEffect(() => {
    const video = videoRef.current;
    function onFullscreenChange() {
      const active = isVideoFullscreen(video);
      setFullscreen(active);
      pointerOverControlsRef.current = false;
      draggingRef.current = false;
      keyboardFocusRef.current = false;
      revealControls();
      // Restore focus inside the same viewer, without changing the selected post.
      if (!active || document.fullscreenElement === frameRef.current) frameRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    video?.addEventListener("webkitbeginfullscreen", onFullscreenChange);
    video?.addEventListener("webkitendfullscreen", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      video?.removeEventListener("webkitbeginfullscreen", onFullscreenChange);
      video?.removeEventListener("webkitendfullscreen", onFullscreenChange);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, [videoRef, revealControls]);

  async function toggleFullscreen() {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    try {
      onNotice(null);
      if (isVideoFullscreen(videoRef.current)) await exitVideoFullscreen(videoRef.current);
      else {
        onCancelPendingNavigation();
        const video = videoRef.current as FullscreenVideo | null;
        if (frameRef.current?.requestFullscreen) await frameRef.current.requestFullscreen();
        else if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
        else onNotice("Полноэкранный режим недоступен в этом браузере.");
      }
    } catch {
      onNotice("Не удалось открыть полноэкранный режим. Попробуйте ещё раз.");
    }
  }

  function onVideoClick(event: MouseEvent<HTMLVideoElement>) {
    if (pointerTypeRef.current === "touch") {
      if (isVideoFullscreen(videoRef.current)) {
        if (controlsVisible && !playback.paused) setControlsVisible(false);
        else revealControls();
      } else onTogglePlayback();
      return;
    }
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    if (event.detail > 1) return;
    clickPlaybackRef.current = {
      paused: videoRef.current?.paused ?? true,
      time: videoRef.current?.currentTime ?? 0,
      applied: false,
    };
    clickTimerRef.current = setTimeout(() => {
      if (clickPlaybackRef.current) clickPlaybackRef.current.applied = true;
      onTogglePlayback();
    }, SINGLE_CLICK_DELAY_MS);
  }

  function onVideoDoubleClick() {
    if (pointerTypeRef.current === "touch") return;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    const previous = clickPlaybackRef.current;
    const video = videoRef.current;
    // A slow double click can arrive after the single-click action has already run.
    if (previous?.applied && video) {
      if (previous.paused) {
        video.pause();
        video.currentTime = previous.time;
      } else if (video.paused) void video.play().catch(() => {});
    }
    clickPlaybackRef.current = null;
    void toggleFullscreen();
  }

  function onFrameKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    keyboardFocusRef.current = true;
    revealControls();
    if (!isVideoFullscreen(videoRef.current)) return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)"));
    if (!controls.length) return;
    event.preventDefault();
    event.stopPropagation();
    const index = controls.findIndex((control) => control === document.activeElement);
    const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0)
      : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    controls[next].focus();
  }

  function onFramePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !isVideoFullscreen(videoRef.current)) return;
    pointerOverControlsRef.current = event.target instanceof Element && Boolean(event.target.closest("[data-video-controls]"));
    const bottom = event.currentTarget.getBoundingClientRect().bottom;
    const height = controlsRef.current?.getBoundingClientRect().height ?? 88;
    if (event.clientY >= bottom - height - 24) revealControls();
  }

  function onControlsBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      keyboardFocusRef.current = false;
      scheduleHide();
    }
  }

  function onFramePointerDown() {
    keyboardFocusRef.current = false;
  }

  function onFramePointerLeave() {
    pointerOverControlsRef.current = false;
    scheduleHide();
  }

  function onVideoPointerDown(event: PointerEvent<HTMLVideoElement>) {
    pointerTypeRef.current = event.pointerType;
  }

  function onControlsPointerEnter() {
    pointerOverControlsRef.current = true;
    revealControls();
  }

  function onControlsPointerLeave() {
    pointerOverControlsRef.current = false;
    scheduleHide();
  }

  function onControlsPointerDown() {
    draggingRef.current = true;
    revealControls();
  }

  const visible = !fullscreen || controlsVisible || playback.paused || playback.buffering || playback.failed || Boolean(notice);
  return {
    frameRef, controlsRef, fullscreen, visible, revealControls, toggleFullscreen,
    onFrameKeyDown, onFramePointerDown, onFramePointerMove, onFramePointerLeave,
    onVideoPointerDown, onVideoClick, onVideoDoubleClick,
    onControlsPointerEnter, onControlsPointerLeave, onControlsPointerDown, onControlsBlur,
  };
}
