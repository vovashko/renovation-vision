import * as React from "react";

import { cn } from "@/lib/utils";

// A QR code image (e.g. the `data:image/svg+xml` URI Supabase returns for a TOTP enrollment) on a
// white tile with a quiet zone, so phone cameras read it in dark mode too, plus the same value as
// text for typing by hand.

function QrCode({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div data-slot="qr-code" className={cn("mx-auto w-fit rounded-lg border border-outline-variant bg-white p-3", className)}>
      <img src={src} alt={alt} width={176} height={176} className="size-44" />
    </div>
  );
}

/** A secret shown for manual entry: monospace, wrapping, selectable in one tap. */
function QrSecret({ className, ...props }: React.ComponentProps<"code">) {
  return (
    <code
      data-slot="qr-secret"
      className={cn(
        "block rounded-md bg-surface-container-low px-3 py-2 text-center font-mono text-body-md tracking-wider break-all text-on-surface select-all",
        className,
      )}
      {...props}
    />
  );
}

export { QrCode, QrSecret };
