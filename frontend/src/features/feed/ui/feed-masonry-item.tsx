"use client";

import type { ReactNode } from "react";

type FeedMasonryItemProps = {
  children: ReactNode;
  featured: boolean;
  className?: string;
  onElement: (element: HTMLDivElement | null) => void;
};

export function FeedMasonryItem({
  children,
  featured,
  className = "",
  onElement,
}: FeedMasonryItemProps) {
  return (
    <div
      ref={onElement}
      className={`mb-2.5 min-w-0 break-inside-avoid lg:mb-4 ${featured ? "[column-span:all]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
