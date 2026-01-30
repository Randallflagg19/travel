"use client";

import { useCallback, useEffect, useState } from "react";

export function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setInView(Boolean(entry?.isIntersecting));
      },
      { root: options?.root ?? null, rootMargin: options?.rootMargin, threshold: options?.threshold },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [node, options?.root, options?.rootMargin, options?.threshold]);

  const ref = useCallback((el: T | null) => {
    setNode(el);
  }, []);

  return { ref, inView };
}

