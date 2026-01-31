"use client";

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/entities/session/model/auth";
import { adminCloudinaryConfig, adminCloudinarySignUpload, createPost } from "@/shared/api/api";

declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (options: unknown, callback: (error: unknown, result: unknown) => void) => {
        open: () => void;
      };
    };
  }
}

function loadCloudinaryWidgetScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.cloudinary?.createUploadWidget) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-cloudinary-widget="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Cloudinary widget failed to load")));
      return;
    }

    const s = document.createElement("script");
    s.src = "https://widget.cloudinary.com/v2.0/global/all.js";
    s.async = true;
    s.defer = true;
    s.dataset.cloudinaryWidget = "true";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Cloudinary widget failed to load"));
    document.head.appendChild(s);
  });
}

function pickMediaType(resourceType: string | undefined, format: string | undefined) {
  if (resourceType === "image") return "PHOTO" as const;
  if (resourceType === "video") {
    const fmt = (format ?? "").toLowerCase();
    const audio = new Set(["mp3", "m4a", "wav", "aac", "ogg", "flac", "opus"]);
    if (audio.has(fmt)) return "AUDIO" as const;
    return "VIDEO" as const;
  }
  return "PHOTO" as const;
}

export function CloudinaryUploadButton(props: { size?: "sm" | "default"; variant?: "default" | "secondary" | "ghost" }) {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const widgetRef = useRef<{ open: () => void } | null>(null);

  const ctx = useMemo(() => {
    const country = searchParams.get("country") ?? "";
    const city = searchParams.get("city") ?? "";
    const unknown = searchParams.get("unknown") === "true";
    const all = searchParams.get("all") === "true";
    return { country, city, unknown, all };
  }, [searchParams]);

  const canUpload = Boolean(auth.user && auth.accessToken && (auth.user.role === "ADMIN" || auth.user.role === "SUPERADMIN"));

  async function onClick() {
    if (!canUpload) return;
    if (!auth.accessToken) return;
    if (!auth.user) return;

    setBusy(true);
    try {
      const { cloudName, apiKey } = await adminCloudinaryConfig(auth.accessToken);
      await loadCloudinaryWidgetScript();

      const root = auth.user.username || "uploads";
      const folder = ctx.country && ctx.city ? `${root}/${ctx.country}/${ctx.city}` : ctx.unknown ? `${root}/unknown` : `${root}/all`;

      if (!widgetRef.current) {
        const widget = window.cloudinary?.createUploadWidget(
          {
            cloudName,
            apiKey,
            folder,
            multiple: true,
            resourceType: "auto",
            sources: ["local", "camera", "url"],
            // Keep Cloudinary filenames (nicer folders). Cloudinary will ensure uniqueness.
            use_filename: true,
            unique_filename: true,
            uploadSignature: async (callback: (signature: string, timestamp: number) => void, params: unknown) => {
              const signed = await adminCloudinarySignUpload(auth.accessToken as string, (params ?? {}) as Record<string, unknown>);
              callback(signed.signature, signed.timestamp);
            },
          },
          async (_error: unknown, result: unknown) => {
            const r = result as {
              event?: string;
              info?: {
                secure_url?: string;
                public_id?: string;
                resource_type?: string;
                format?: string;
                folder?: string;
              };
            };
            if (r.event !== "success" || !r.info) return;
            const info = r.info;
            const mediaUrl = (info.secure_url ?? "").trim();
            const publicId = (info.public_id ?? "").trim();
            if (!mediaUrl) return;

            try {
              await createPost(auth.accessToken as string, {
                mediaType: pickMediaType(info.resource_type, info.format),
                mediaUrl,
                cloudinaryPublicId: publicId || undefined,
                folder: info.folder || folder,
                country: ctx.country && ctx.city ? ctx.country : undefined,
                city: ctx.country && ctx.city ? ctx.city : undefined,
              });
            } catch (e) {
              console.error("createPost failed", e);
            }
          },
        );
        widgetRef.current = widget ?? null;
      }

      widgetRef.current?.open();
    } finally {
      setBusy(false);
    }
  }

  if (!canUpload) return null;

  return (
    <Button size={props.size ?? "sm"} variant={props.variant ?? "secondary"} onClick={onClick} disabled={busy || auth.isLoading}>
      {busy ? "Upload…" : "Upload"}
    </Button>
  );
}

