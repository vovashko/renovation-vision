import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the M3 utilities from styles.css. Without this, `text-label-lg`
// is read as a text color and dropped when combined with e.g. `text-on-primary`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-lg",
            "display-md",
            "display-sm",
            "headline-lg",
            "headline-md",
            "headline-sm",
            "title-lg",
            "title-md",
            "title-sm",
            "body-lg",
            "body-md",
            "body-sm",
            "label-lg",
            "label-md",
            "label-sm",
          ],
        },
      ],
      shadow: [{ shadow: ["el1", "el2", "el3", "el4", "el5"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
