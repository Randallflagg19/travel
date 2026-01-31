const TOKEN_KEY = "travel_access_token";

const tokenListeners = new Set<() => void>();

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    tokenListeners.forEach((cb) => cb());
  } catch {
    // ignore
  }
}

export function clearAccessToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    tokenListeners.forEach((cb) => cb());
  } catch {
    // ignore
  }
}

/** Subscribe to token changes (login/logout). For useSyncExternalStore. */
export function subscribeToken(onStoreChange: () => void): () => void {
  tokenListeners.add(onStoreChange);
  return () => tokenListeners.delete(onStoreChange);
}

