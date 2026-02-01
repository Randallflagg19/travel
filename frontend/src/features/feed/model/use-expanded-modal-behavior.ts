"use client";

import { useEffect, useRef } from "react";

/**
 * При открытой модалке: закрытие по ESC и блокировка скролла body
 * (чтобы при закрытии позиция скролла не прыгала).
 */
export function useExpandedModalBehavior(
  isOpen: boolean,
  onClose: () => void,
): void {
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    scrollYRef.current = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.width = "100%";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, scrollYRef.current);
    };
  }, [isOpen]);
}
