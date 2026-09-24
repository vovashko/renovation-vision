import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";

export type LightboxItem = {
  src: string;
  alt: string;
  title: string;
  subtitle?: string;
  tags?: string[];
};

export function Lightbox({
  items,
  index,
  onClose,
}: {
  items: LightboxItem[];
  index: number | null;
  onClose: () => void;
}) {
  const [i, setI] = useState(index ?? 0);
  const touchX = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = index !== null && items.length > 0;

  useEffect(() => {
    if (index !== null) setI(index);
  }, [index]);

  const prev = () => setI((x) => (x - 1 + items.length) % items.length);
  const next = () => setI((x) => (x + 1) % items.length);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab" && dialogRef.current) {
        // Keep focus inside the viewer.
        const f = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button"));
        const first = f[0],
          last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length]);

  if (!open) return null;
  const item = items[Math.min(i, items.length - 1)];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo viewer: ${item.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) {
          if (dx > 0) prev();
          else next();
        }
        touchX.current = null;
      }}
    >
      <div className="flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="text-label-lg text-white/80" aria-live="polite">
          {i + 1} / {items.length}
        </span>
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close viewer"
          className="state-layer flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <img
          src={item.src}
          alt={item.alt}
          className="max-h-full max-w-full select-none rounded-md object-contain"
          draggable={false}
        />
        {items.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous photo"
              className="state-layer flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white absolute left-2 bg-black/50"
            >
              <Icon name="chevron_left" />
            </button>
            <button
              onClick={next}
              aria-label="Next photo"
              className="state-layer flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white absolute right-2 bg-black/50"
            >
              <Icon name="chevron_right" />
            </button>
          </>
        )}
      </div>
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="text-title-md">{item.title}</div>
        {item.subtitle && <div className="mt-1 text-body-md text-white/70">{item.subtitle}</div>}
        {item.tags && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
