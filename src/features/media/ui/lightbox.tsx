import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LightboxItem } from "@/features/media/domain/photo-helpers";

export type { LightboxItem };

export function Lightbox({ items, index, onClose }: { items: LightboxItem[]; index: number | null; onClose: () => void }) {
  const { t } = useTranslation(["media"]);
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
      aria-label={t("lightbox.viewerAria", { title: item.title })}
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
          {t("lightbox.counter", { current: i + 1, total: items.length })}
        </span>
        <Button ref={closeRef} variant="scrim" size="icon" onClick={onClose} aria-label={t("lightbox.closeAria")}>
          <Icon name="close" size={22} />
        </Button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <img src={item.src} alt={item.alt} className="max-h-full max-w-full rounded-md object-contain select-none" draggable={false} />
        {items.length > 1 && (
          <>
            <Button variant="scrim" size="icon" onClick={prev} aria-label={t("lightbox.prevAria")} className="absolute left-2">
              <Icon name="chevron_left" size={22} />
            </Button>
            <Button variant="scrim" size="icon" onClick={next} aria-label={t("lightbox.nextAria")} className="absolute right-2">
              <Icon name="chevron_right" size={22} />
            </Button>
          </>
        )}
      </div>
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="text-title-md">{item.title}</div>
        {item.subtitle && <div className="mt-1 text-body-md text-white/70">{item.subtitle}</div>}
        {item.tags && item.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
