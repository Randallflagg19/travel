"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/entities/session/model/auth";
import { useSelectedAuthor } from "@/features/feed/model/use-selected-author";
import { readPlaceSelection } from "@/features/places/model/place-selection";
import { MediaPostComposer } from "./media-post-composer";

export function CloudinaryUploadButton(props: {
  size?: "sm" | "default" | "icon";
  variant?: "default" | "secondary" | "ghost";
  iconOnly?: boolean;
  className?: string;
}) {
  const auth = useAuth();
  const { author, isReady } = useSelectedAuthor();
  const search = useSearchParams();
  const [context, setContext] = useState<{ country: string; city: string } | null>(null);
  const canUpload = auth.user && auth.accessToken && isReady && author?.id === auth.user.id &&
    (auth.user.role === "ADMIN" || auth.user.role === "SUPERADMIN");
  if (!canUpload || !auth.user || !auth.accessToken) return null;

  return <>
    <Button size={props.size ?? "sm"} variant={props.variant ?? "secondary"} className={props.className}
      onClick={() => {
        const { selectedCountry, selectedCity } = readPlaceSelection(search);
        setContext({ country: selectedCountry, city: selectedCity });
      }}
      aria-label="Новая публикация" disabled={auth.isLoading}>
      {props.iconOnly ? <Upload className="size-4" /> : "Публикация"}
    </Button>
    {context ? <MediaPostComposer key={auth.user.id} accessToken={auth.accessToken}
      initialCountry={context.country} initialCity={context.city} onClose={() => setContext(null)} /> : null}
  </>;
}
