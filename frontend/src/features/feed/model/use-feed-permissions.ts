"use client";

import type { AuthUser } from "@/shared/api/api";

export type FeedPermissions = {
  canDelete: boolean;
  canLike: boolean;
  canComment: boolean;
};

export function useFeedPermissions(user: AuthUser | null): FeedPermissions {
  const canDelete = Boolean(
    user && (user.role === "ADMIN" || user.role === "SUPERADMIN"),
  );

  const canLike = Boolean(
    user &&
      (user.role === "USER" ||
        user.role === "ADMIN" ||
        user.role === "SUPERADMIN"),
  );

  const canComment = Boolean(
    user && (user.role === "ADMIN" || user.role === "SUPERADMIN"),
  );

  return { canDelete, canLike, canComment };
}
