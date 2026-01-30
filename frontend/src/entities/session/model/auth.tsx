"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authLogin, authMe, authRegister, type AuthUser } from "@/shared/api/api";
import { clearAccessToken, getAccessToken, setAccessToken } from "./token";

type AuthContextValue = {
  accessToken: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  login: (params: { email: string; password: string }) => Promise<void>;
  register: (params: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [accessToken, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    setTokenState(getAccessToken());
  }, []);

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
    if (msg.includes("(401)")) {
      clearAccessToken();
      setTokenState(null);
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
    }
  }, [meQuery.isError, meQuery.error, queryClient]);

  const user = meQuery.data?.user ?? null;

  const value = useMemo<AuthContextValue>(() => {
    return {
      accessToken,
      user,
      isLoading: Boolean(accessToken) && meQuery.isLoading,
      error: (meQuery.error instanceof Error ? meQuery.error : null) ?? null,
      async login(params) {
        const res = await authLogin(params);
        setAccessToken(res.accessToken);
        setTokenState(res.accessToken);
        queryClient.setQueryData(["auth", "me", res.accessToken], { user: res.user });
      },
      async register(params) {
        const res = await authRegister(params);
        setAccessToken(res.accessToken);
        setTokenState(res.accessToken);
        queryClient.setQueryData(["auth", "me", res.accessToken], { user: res.user });
      },
      logout() {
        clearAccessToken();
        setTokenState(null);
        queryClient.removeQueries({ queryKey: ["auth", "me"] });
      },
    };
  }, [accessToken, user, meQuery.isLoading, meQuery.error, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

