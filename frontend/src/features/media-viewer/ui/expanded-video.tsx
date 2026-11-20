"use client";

import { type RefObject, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useVideoPlayback } from "../model/use-video-playback";
import { useVideoInteractions } from "../model/use-video-interactions";
import { ExpandedVideoControls } from "./expanded-video-controls";

type ExpandedVideoProps = {
  src: string | null;
  poster?: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  shouldAutoPlayRef: RefObject<boolean>;
  onCancelPendingNavigation: () => void;
};

export function ExpandedVideo({ src, poster, videoRef, shouldAutoPlayRef, onCancelPendingNavigation }: ExpandedVideoProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const {
    state: playback, attachVideo, syncPlayback, togglePlayback,
    seek, changeVolume, toggleMute, retry, onReadyToPlay, onBuffering,
  } = useVideoPlayback({ videoRef, shouldAutoPlayRef, onNotice: setNotice });
  const {
    frameRef, controlsRef, fullscreen, visible, revealControls, toggleFullscreen,
    onFrameKeyDown, onFramePointerDown, onFramePointerMove, onFramePointerLeave,
    onVideoPointerDown, onVideoClick, onVideoDoubleClick,
    onControlsPointerEnter, onControlsPointerLeave, onControlsPointerDown, onControlsBlur,
  } = useVideoInteractions({
    videoRef, playback, notice, onNotice: setNotice,
    onTogglePlayback: togglePlayback, onCancelPendingNavigation,
  });

  function onPlaybackInteraction() {
    syncPlayback();
    revealControls();
  }

  return (
    <div
      ref={frameRef}
      onKeyDownCapture={onFrameKeyDown}
      onPointerDownCapture={onFramePointerDown}
      onPointerMove={onFramePointerMove}
      onPointerLeave={onFramePointerLeave}
      data-video-player
      data-controls-visible={visible}
      tabIndex={-1}
      className={`@container/video relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-lg bg-black outline-none ${fullscreen && !visible ? "cursor-none" : ""}`}
    >
      <div className="relative min-h-0 flex-1">
        <video
          ref={attachVideo}
          onLoadedMetadata={onReadyToPlay}
          onCanPlay={onReadyToPlay}
          onDurationChange={syncPlayback}
          onTimeUpdate={syncPlayback}
          onWaiting={onBuffering}
          onPointerDown={onVideoPointerDown}
          onClick={onVideoClick}
          onDoubleClick={onVideoDoubleClick}
          onPlay={onPlaybackInteraction}
          onPause={onPlaybackInteraction}
          onEnded={onPlaybackInteraction}
          onVolumeChange={onPlaybackInteraction}
          onSeeking={onPlaybackInteraction}
          onSeeked={onPlaybackInteraction}
          onPlaying={onPlaybackInteraction}
          onError={onPlaybackInteraction}
          className="h-full w-full object-contain outline-none"
          playsInline
          preload="metadata"
          src={src || undefined}
          poster={poster}
          aria-label="Видео поста"
        />
        {playback.buffering && !playback.failed ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status" aria-label="Загружаем видео">
            <LoaderCircle className="size-7 animate-spin text-[#83c8b6]" />
          </div>
        ) : null}
        {playback.failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-5 text-center text-sm text-amber-50" role="alert" data-video-controls>
            <span>Не удалось загрузить видео</span>
            <button type="button" className="min-h-11 rounded-lg border border-white/25 px-4 outline-none focus-visible:ring-2 focus-visible:ring-[#83c8b6]" onClick={retry}>
              Повторить
            </button>
          </div>
        ) : null}
      </div>
      <ExpandedVideoControls
        controlsRef={controlsRef}
        onPointerEnter={onControlsPointerEnter}
        onPointerLeave={onControlsPointerLeave}
        onPointerDown={onControlsPointerDown}
        onFocusCapture={revealControls}
        onBlurCapture={onControlsBlur}
        playback={playback}
        fullscreen={fullscreen}
        visible={visible}
        notice={notice}
        onTogglePlayback={togglePlayback}
        onSeek={seek}
        onToggleMute={toggleMute}
        onVolumeChange={changeVolume}
        onToggleFullscreen={() => { void toggleFullscreen(); }}
      />
    </div>
  );
}
