import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

/**
 * v5 segmented control for picking one value in a form (same look as the Tabs track: a pill
 * track, the selected segment lifts to a lighter fill). A radio group underneath, so arrow keys
 * move the selection. `size="field"` is 44px tall to line up with inputs and buttons.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  size = "default",
  className,
  ...props
}: {
  value: T;
  onValueChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: "default" | "field";
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  id?: string;
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      orientation="horizontal"
      className={cn("inline-flex items-center gap-0.5 rounded-full bg-on-surface/12 p-0.5 text-on-surface", size === "field" && "h-11 p-1", className)}
      {...props}
    >
      {options.map((o) => (
        <RadioGroupPrimitive.Item
          key={o.value}
          value={o.value}
          // Arrow keys move focus; select on keyboard focus like native radios (tabbing in lands on
          // the checked item, so it changes nothing).
          onFocus={(e) => e.currentTarget.matches(":focus-visible") && o.value !== value && onValueChange(o.value)}
          className={cn(
            "inline-flex flex-1 items-center justify-center rounded-full px-3.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[state=checked]:bg-surface-container-lowest data-[state=checked]:font-medium",
            size === "field" ? "h-9 text-label-lg" : "h-7.5 text-[13px]",
          )}
        >
          {o.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
