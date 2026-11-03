type NativeFullscreenVideo = HTMLVideoElement & {
  webkitDisplayingFullscreen?: boolean;
  webkitExitFullscreen?: () => void;
};

export function isVideoFullscreen(video: HTMLVideoElement | null) {
  return Boolean(video && (document.fullscreenElement?.contains(video) ||
    (video as NativeFullscreenVideo).webkitDisplayingFullscreen));
}

export async function exitVideoFullscreen(video: HTMLVideoElement | null) {
  if (document.fullscreenElement) await document.exitFullscreen();
  else (video as NativeFullscreenVideo | null)?.webkitExitFullscreen?.();
}

// Each video remembers its own audible level; detached elements can be collected.
const audibleVolumes = new WeakMap<HTMLVideoElement, number>();

export function syncVideoVolume(video: HTMLVideoElement) {
  if (video.volume > 0) audibleVolumes.set(video, video.volume);
  else if (!video.muted) video.muted = true;
}

export function setVideoVolume(video: HTMLVideoElement, volume: number, unmute = true) {
  syncVideoVolume(video);
  const stayMuted = video.muted && !unmute;
  video.volume = Math.min(1, Math.max(0, volume));
  video.muted = video.volume === 0 || stayMuted;
  syncVideoVolume(video);
}

export function toggleVideoMute(video: HTMLVideoElement) {
  if (video.muted || video.volume === 0) {
    if (video.volume === 0) video.volume = audibleVolumes.get(video) ?? 0.5;
    video.muted = false;
  } else {
    syncVideoVolume(video);
    video.muted = true;
  }
}
