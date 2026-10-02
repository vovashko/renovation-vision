import * as React from "react";

import { cn } from "@/lib/utils";

// The full-screen shell of the signed-out / step-up screens (sign in, forgot/reset password, 2FA):
// a centered column on the surface color with one card in it, no app rail.

function AuthScreen({ className, children, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="auth-screen"
      className={cn("flex min-h-screen items-center justify-center bg-surface px-4 py-10 text-on-surface", className)}
      {...props}
    >
      <div className="flex w-full max-w-sm flex-col gap-5">{children}</div>
    </main>
  );
}

/** The screen's card: 24px padding, its content stacked 20px apart. */
function AuthCard({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="auth-card"
      className={cn("flex flex-col gap-5 rounded-xl border border-outline-variant bg-card p-6", className)}
      {...props}
    />
  );
}

/** Logo, title and subtitle at the top of the card. */
function AuthCardHeader({
  logo,
  logoAlt,
  title,
  description,
}: {
  logo?: string;
  logoAlt?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <header data-slot="auth-card-header" className="flex flex-col gap-1">
      {logo && <img src={logo} alt={logoAlt ?? ""} className="mb-5 h-9 w-fit" />}
      <h1 className="text-headline-md text-on-surface">{title}</h1>
      {description && <p className="text-body-md text-on-surface-variant">{description}</p>}
    </header>
  );
}

/** Secondary links and actions under the main form, centered. */
function AuthCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="auth-card-footer" className={cn("flex flex-col items-center gap-1 text-body-md", className)} {...props} />;
}

/** A thin rule with a label in the middle ("or"). */
function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div data-slot="auth-divider" className="flex items-center gap-3 text-label-md text-on-surface-variant">
      <span className="h-px flex-1 bg-outline-variant" />
      {children}
      <span className="h-px flex-1 bg-outline-variant" />
    </div>
  );
}

export { AuthScreen, AuthCard, AuthCardHeader, AuthCardFooter, AuthDivider };
