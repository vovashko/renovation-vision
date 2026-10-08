import { Toaster as Sonner } from "sonner";
import { Icon } from "@/components/ui/icon";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// v5 toast: inverse surface, 12px corners, float shadow, body-md. Bottom-right on desktop; on phones
// Sonner goes full-width at the bottom, lifted above the bottom tab bar (5rem) and the safe area.
// Default 4 s; pass `duration: 8000` with an `action` (e.g. Undo).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      duration={4000}
      mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom) + 1rem)" }}
      icons={{
        success: <Icon name="check" size={20} />,
        error: <Icon name="error" size={20} />,
        info: <Icon name="info" size={20} />,
        warning: <Icon name="warning" size={20} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex min-h-12 w-full items-center gap-3 rounded-md bg-inverse-surface py-3 pr-2 pl-4 text-body-md text-inverse-on-surface shadow-float sm:w-[356px]",
          title: "flex-1",
          description: "text-body-sm opacity-80",
          icon: "shrink-0",
          success: "[&_[data-icon]]:text-success-container",
          error: "[&_[data-icon]]:text-error-container",
          warning: "[&_[data-icon]]:text-attention-container",
          actionButton: "state-layer h-9 shrink-0 rounded-md px-3 text-label-lg text-primary-container",
          cancelButton: "state-layer h-9 shrink-0 rounded-md px-3 text-label-lg text-inverse-on-surface",
          closeButton: "state-layer grid size-10 place-items-center rounded-full text-inverse-on-surface",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
