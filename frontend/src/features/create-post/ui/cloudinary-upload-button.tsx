"use client";

import { useState } from "react";
import type { CreatePostContext } from "../model/create-post-context";
import { Upload } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/entities/session";
import { MediaPostComposer } from "./media-post-composer";

export function CloudinaryUploadButton(props: {
  journal: CreatePostContext;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "secondary" | "ghost";
  iconOnly?: boolean;
  className?: string;
}) {
  const auth = useAuth();
  const [context, setContext] = useState<{
    country: string;
    city: string;
  } | null>(null);
  const canUpload =
    auth.user &&
    auth.accessToken &&
    props.journal.ready &&
    props.journal.authorId === auth.user.id &&
    (auth.user.role === "ADMIN" || auth.user.role === "SUPERADMIN");
  if (!canUpload || !auth.user || !auth.accessToken) return null;

  return (
    <>
      <Button
        size={props.size ?? "sm"}
        variant={props.variant ?? "secondary"}
        className={props.className}
        onClick={() => {
          setContext({
            country: props.journal.country,
            city: props.journal.city,
          });
        }}
        aria-label="Новая публикация"
        disabled={auth.isLoading}
      >
        {props.iconOnly ? <Upload className="size-4" /> : "Публикация"}
      </Button>
      {context ? (
        <MediaPostComposer
          key={auth.user.id}
          accessToken={auth.accessToken}
          initialCountry={context.country}
          initialCity={context.city}
          onClose={() => setContext(null)}
        />
      ) : null}
    </>
  );
}
