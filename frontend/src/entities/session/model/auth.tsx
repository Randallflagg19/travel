"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authLogin, authMe, authRegister, type AuthUser } from "@/shared/api/api";
import { clearAccessToken, getAccessToken, setAccessToken, subscribeToken } from "./token";

type AuthContextValue = {
  accessToken: string | null;
  /** False on server, true on client. Use to avoid first fetch without token (SSR). */
  hydrated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  login: (params: { login: string; password: string }) => Promise<void>;
  register: (params: { username: string; password: string; email?: string; name?: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getServerSnapshot(): null {
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const accessToken = useSyncExternalStore(
    subscribeToken,
    getAccessToken,
    getServerSnapshot,
  );
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const meQuery = useQuery({
    queryKey: ["auth", "me", accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      return await authMe(accessToken as string);
    },
    retry: false,
  });

  // If token invalid, clear it to avoid "stuck" state.
  useEffect(() => {
    if (!meQuery.isError) return;
    const msg = meQuery.error instanceof Error ? meQuery.error.message : "";
    if (!msg.includes("(401)")) return;

    clearAccessToken();
    queryClient.removeQueries({ queryKey: ["auth", "me"] });
  }, [meQuery.isError, meQuery.error, queryClient]);

  const user = meQuery.data?.user ?? null;

  const value = useMemo<AuthContextValue>(() => {
    return {
      accessToken,
      hydrated,
      user,
      isLoading: Boolean(accessToken) && meQuery.isLoading,
      error: (meQuery.error instanceof Error ? meQuery.error : null) ?? null,
      async login(params) {
        const res = await authLogin(params);
        setAccessToken(res.accessToken);
        queryClient.setQueryData(["auth", "me", res.accessToken], { user: res.user });
      },
      async register(params) {
        const res = await authRegister(params);
        setAccessToken(res.accessToken);
        queryClient.setQueryData(["auth", "me", res.accessToken], { user: res.user });
      },
      logout() {
        clearAccessToken();
        queryClient.removeQueries({ queryKey: ["auth", "me"] });
      },
    };
  }, [accessToken, hydrated, user, meQuery.isLoading, meQuery.error, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

