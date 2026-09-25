import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

export type LightboxItem = { src: string; alt: string; title: string; subtitle?: string; tags?: string[] };

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
  const open = index !== null && items.length > 0;

  useEffect(() => { if (index !== null) setI(index); }, [index]);

  const prev = () => setI((x) => (x - 1 + items.length) % items.length);
  const next = () => setI((x) => (x + 1) % items.length);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length]);

  if (!open) return null;
  const item = items[Math.min(i, items.length - 1)];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo viewer: ${item.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-foreground/95 text-background"
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
        <span className="text-sm opacity-80">{i + 1} / {items.length}</span>
        <button ref={closeRef} onClick={onClose} aria-label="Close viewer" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Icon name="close" size={24} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <img src={item.src} alt={item.alt} className="max-h-full max-w-full rounded-lg object-contain" />
        {items.length > 1 && (
          <>
            <button onClick={prev} aria-label="Previous photo" className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-foreground/60 hover:bg-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Icon name="chevron_left" size={24} />
            </button>
            <button onClick={next} aria-label="Next photo" className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-foreground/60 hover:bg-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Icon name="chevron_right" size={24} />
            </button>
          </>
        )}
      </div>
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="font-semibold">{item.title}</div>
        {item.subtitle && <div className="mt-1 text-sm opacity-80">{item.subtitle}</div>}
        {item.tags && (
          <div className="mt-2 flex flex-wrap gap-2">
            {item.tags.map((t) => (
              <span key={t} className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
