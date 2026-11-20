import type { HTMLAttributes, RefObject } from "react";
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { VideoPlaybackState } from "../model/use-video-playback";
import styles from "./expanded-video-controls.module.css";

type ControlsEvents = Pick<HTMLAttributes<HTMLDivElement>,
  "onPointerEnter" | "onPointerLeave" | "onPointerDown" | "onFocusCapture" | "onBlurCapture"
>;
type ExpandedVideoControlsProps = ControlsEvents & {
  playback: VideoPlaybackState;
  fullscreen: boolean;
  visible: boolean;
  notice: string | null;
  controlsRef: RefObject<HTMLDivElement | null>;
  onTogglePlayback: () => void;
  onSeek: (time: number) => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleFullscreen: () => void;
};

type VideoSliderProps = {
  label: string;
  value: number;
  max: number;
  step: number;
  valueText: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
};

const buttonClass = [
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-amber-50 outline-none",
  "hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#83c8b6] disabled:cursor-default disabled:opacity-40",
].join(" ");
function formatTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value / 60) % 60;
  const minutesText = hours ? String(minutes).padStart(2, "0") : String(minutes);
  const time = `${minutesText}:${String(value % 60).padStart(2, "0")}`;
  return hours ? `${hours}:${time}` : time;
}

function VideoSlider({
  label, value, max, step, valueText, onChange, disabled, className = "",
}: VideoSliderProps) {
  const progress = max ? Math.min(100, value / max * 100) : 0;
  return (
    <div className={`relative flex h-11 items-center ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 h-1 rounded-full" style={{ background: `linear-gradient(to right, #83c8b6 ${progress}%, #ffffff30 ${progress}%)` }} />
      <input
        type="range" min="0" max={max} step={step} value={Math.min(value, max)} disabled={disabled}
        aria-label={label} aria-valuetext={valueText} className={styles.slider}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}

export function ExpandedVideoControls({
  playback, fullscreen, visible, notice, controlsRef,
  onTogglePlayback, onSeek, onToggleMute, onVolumeChange, onToggleFullscreen,
  onPointerEnter, onPointerLeave, onPointerDown, onFocusCapture, onBlurCapture,
}: ExpandedVideoControlsProps) {
  const audibleVolume = playback.muted ? 0 : playback.volume;
  const placement = fullscreen
    ? "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 to-black/55 pt-3"
    : "shrink-0 border-t border-white/10 bg-[#0b1519]";

  return (
    <div
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
      ref={controlsRef} data-video-controls aria-label="Управление видео"
      className={`px-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-amber-50 transition-opacity duration-200 ${placement} ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <VideoSlider
        label="Позиция видео" value={playback.time} max={playback.duration || 0} step={0.1}
        valueText={`${formatTime(playback.time)} из ${formatTime(playback.duration)}`}
        disabled={!playback.duration || playback.failed} onChange={onSeek}
      />
      <div className="-mt-1 flex min-w-0 items-center gap-1 sm:gap-2">
        <button type="button" aria-label={playback.paused ? "Воспроизвести" : "Пауза"} className={buttonClass} disabled={playback.failed} onClick={onTogglePlayback}>
          {playback.paused ? <Play className="size-5" /> : <Pause className="size-5" />}
        </button>
        <span className="shrink-0 text-xs tabular-nums text-amber-50/75" aria-live="off">
          {formatTime(playback.time)} / {formatTime(playback.duration)}
        </span>
        <div className="min-w-0 flex-1 text-center">
          <p className="hidden whitespace-nowrap px-2 text-xs text-amber-50/60 lg:@min-[1000px]/video:block">
            {fullscreen ? "← →" : "Shift + ← →"} — перемотка 5 с · Пробел — пауза · ↑ ↓ — громкость · M — звук
          </p>
        </div>
        <button type="button" aria-label={audibleVolume === 0 ? "Включить звук" : "Выключить звук"} aria-pressed={audibleVolume === 0} className={buttonClass} onClick={onToggleMute}>
          {audibleVolume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
        <VideoSlider
          label="Громкость" value={audibleVolume} max={1} step={0.05}
          valueText={`${Math.round(audibleVolume * 100)}%`} onChange={onVolumeChange}
          className="w-12 shrink-0 sm:w-24"
        />
        <button type="button" aria-label={fullscreen ? "Выйти из полного экрана" : "Полный экран"} className={buttonClass} onClick={onToggleFullscreen}>
          {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
        </button>
      </div>
      {notice ? <p role="status" className="pb-2 text-xs text-amber-50/75">{notice}</p> : null}
    </div>
  );
}
