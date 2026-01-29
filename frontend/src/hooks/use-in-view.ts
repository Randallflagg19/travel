"use client";

import { useEffect, useState } from "react";

export function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, options);

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, options]);

  return { ref: setNode, inView };
}

