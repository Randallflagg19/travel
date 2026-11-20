import { getApiBaseUrl, readApiError } from "@/shared/api/api";

export const LOCAL_MEDIA_LIMITS = { count: 10, photoBytes: 20 * 1024 * 1024, videoBytes: 90 * 1024 * 1024, videoSeconds: 600 };
export type PublicationInput = { uploadIds: string[]; title: string; text: string; country: string; city: string };
type Reservation = {
  cloudName: string; apiKey: string; signature: string; timestamp: number;
  resourceType: "image" | "video"; params: { public_id: string; overwrite: boolean }; ready: boolean;
};

export class MediaPublishingUnavailableError extends Error {
  constructor() {
    super("Публикация с фото и видео пока недоступна на сервере. Попробуйте позже.");
    this.name = "MediaPublishingUnavailableError";
  }
}

async function mediaRequest<T>(token: string, path: string, method: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const request = new AbortController();
  const cancel = () => request.abort();
  const timeout = setTimeout(cancel, 45_000);
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  try {
    const response = await fetch(`${getApiBaseUrl()}/media/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: request.signal,
    });
    if (!response.ok) {
      if (response.status === 404 && method === "PUT" && /^sessions\/[^/]+$/.test(path)) {
        throw new MediaPublishingUnavailableError();
      }
      throw new Error(await readApiError(response));
    }
    return await response.json() as T;
  } catch (error) {
    if (request.signal.aborted && !signal?.aborted) throw new Error("Сервер не ответил вовремя. Попробуйте ещё раз.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

export function openMediaSession(token: string, id: string, signal?: AbortSignal) {
  return mediaRequest<{ id: string; limits: typeof LOCAL_MEDIA_LIMITS }>(token, `sessions/${id}`, "PUT", undefined, signal);
}
export function reserveMedia(token: string, session: string, id: string, type: "PHOTO" | "VIDEO", bytes: number, signal?: AbortSignal) {
  return mediaRequest<Reservation>(token, `sessions/${session}/uploads/${id}`, "PUT", { mediaType: type, bytes }, signal);
}
export function completeMedia(token: string, session: string, id: string, signal?: AbortSignal) {
  return mediaRequest<{ ready: boolean }>(token, `sessions/${session}/uploads/${id}/complete`, "POST", undefined, signal);
}
export function publishMedia(token: string, session: string, body: PublicationInput, signal?: AbortSignal) {
  return mediaRequest<{ postId: string }>(token, `sessions/${session}/publish`, "POST", body, signal);
}
export function cancelMediaSession(token: string, session: string, signal?: AbortSignal) {
  return mediaRequest<{ postId: string | null }>(token, `sessions/${session}`, "DELETE", undefined, signal);
}

export function localMediaType(file: Pick<File, "type" | "name">): "PHOTO" | "VIDEO" | null {
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "avif", "heic", "heif", "gif"].includes(extension) && (!file.type || file.type.startsWith("image/"))) return "PHOTO";
  if (["mp4", "mov", "webm", "mkv", "avi", "m4v", "mpg", "mpeg", "3gp", "ogv"].includes(extension) && (!file.type || file.type.startsWith("video/"))) return "VIDEO";
  return null;
}

export function uploadToCloudinary(file: File, reservation: Reservation, onProgress: (value: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const data = new FormData();
    data.append("file", file);
    data.append("api_key", reservation.apiKey);
    data.append("timestamp", String(reservation.timestamp));
    data.append("signature", reservation.signature);
    for (const [key, value] of Object.entries(reservation.params)) data.append(key, String(value));
    const abort = () => request.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error); else resolve();
    };
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    request.onload = () => finish(request.status >= 200 && request.status < 300 ? undefined : new Error("Не удалось отправить файл. Повторите загрузку."));
    request.onerror = () => finish(new Error("Соединение прервалось. Повторите загрузку."));
    request.ontimeout = () => finish(new Error("Загрузка заняла слишком много времени. Попробуйте ещё раз."));
    request.onabort = () => finish(new DOMException("Загрузка отменена", "AbortError"));
    request.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(reservation.cloudName)}/${reservation.resourceType}/upload`);
    request.timeout = 900_000;
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { finish(new DOMException("Загрузка отменена", "AbortError")); return; }
    request.send(data);
  });
}
