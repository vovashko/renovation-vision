import { Link, type LinkProps } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** Section heading (text-title-lg) with an optional subtitle and a trailing text-button link. */
export function SectionHeader({
  id,
  title,
  sub,
  link,
  linkLabel,
}: {
  id?: string;
  title: string;
  sub?: string;
  link?: Pick<LinkProps, "to" | "params" | "search" | "hash">;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-title-lg">
          {title}
        </h2>
        {sub && <p className="text-body-md text-on-surface-variant">{sub}</p>}
      </div>
      {link && linkLabel && (
        <Link {...link} className={cn(buttonVariants({ variant: "ghost" }), "-mr-3 shrink-0")}>
          {linkLabel}
          <Icon name="arrow_forward" size={20} />
        </Link>
      )}
    </div>
  );
}
