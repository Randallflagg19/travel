import { type RefObject, useCallback, useState } from "react";
import { setVideoVolume, syncVideoVolume, toggleVideoMute } from "./video-element";

export type VideoPlaybackState = {
  paused: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  buffering: boolean;
  failed: boolean;
};

type VideoPlaybackOptions = {
  videoRef: RefObject<HTMLVideoElement | null>;
  shouldAutoPlayRef: RefObject<boolean>;
  onNotice: (message: string | null) => void;
};

export function useVideoPlayback({ videoRef, shouldAutoPlayRef, onNotice }: VideoPlaybackOptions) {
  const [state, setState] = useState<VideoPlaybackState>({
    paused: true, time: 0, duration: 0, volume: 1,
    muted: false, buffering: true, failed: false,
  });

  const attachVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    return () => {
      video?.pause();
      if (videoRef.current === video) videoRef.current = null;
    };
  }, [videoRef]);

  function syncPlayback() {
    const video = videoRef.current;
    if (!video) return;
    syncVideoVolume(video);
    setState({
      paused: video.paused, time: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      volume: video.volume, muted: video.muted,
      buffering: video.readyState < 3, failed: Boolean(video.error),
    });
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    shouldAutoPlayRef.current = false;
    onNotice(null);
    if (video.paused) {
      void video.play().catch((error: unknown) => {
        // Pausing or reloading the media can cancel an otherwise valid play request.
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (videoRef.current !== video) return;
        onNotice("Не удалось начать воспроизведение. Попробуйте ещё раз.");
      });
    } else video.pause();
  }

  function onReadyToPlay() {
    syncPlayback();
    if (shouldAutoPlayRef.current) {
      shouldAutoPlayRef.current = false;
      void videoRef.current?.play().catch(() => {});
    }
  }

  function seek(time: number) {
    if (!videoRef.current) return;
    shouldAutoPlayRef.current = false;
    videoRef.current.currentTime = time;
    syncPlayback();
  }

  function changeVolume(volume: number) {
    if (!videoRef.current) return;
    shouldAutoPlayRef.current = false;
    setVideoVolume(videoRef.current, volume);
  }

  function toggleMute() {
    if (!videoRef.current) return;
    shouldAutoPlayRef.current = false;
    toggleVideoMute(videoRef.current);
  }

  function retry() {
    onNotice(null);
    shouldAutoPlayRef.current = true;
    videoRef.current?.load();
    setState((current) => ({ ...current, failed: false, buffering: true }));
  }

  function onBuffering() {
    setState((current) => ({ ...current, buffering: true }));
  }

  return {
    state, attachVideo, syncPlayback, togglePlayback, seek, changeVolume, toggleMute, retry,
    onReadyToPlay, onBuffering,
  };
}
