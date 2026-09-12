"use client";

import { useEffect, useState } from "react";
import { dict } from "@/lib/i18n";

// Watches the given scroll container (the <main> element) and shows a
// floating button to jump back to its top once scrolled down a bit.
export default function ScrollToTopButton({
  containerRef,
  locale,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  locale: "he" | "en";
}) {
  const [visible, setVisible] = useState(false);
  const t = dict[locale];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setVisible(el.scrollTop > 300);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef]);

  if (!visible) return null;

  return (
    <button
      className="fixed bottom-6 end-6 z-40 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg w-10 h-10 flex items-center justify-center hover:opacity-90"
      onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      title={t.scrollToTop}
      aria-label={t.scrollToTop}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
