import { useEffect, useState } from "react";

const isTextField = (el: Element | null) =>
  !!el &&
  (el.tagName === "TEXTAREA" ||
    (el.tagName === "INPUT" && !["file", "checkbox", "radio", "range", "button", "submit"].includes((el as HTMLInputElement).type)));

/**
 * On-screen keyboard state for touch devices.
 * `inset` is the keyboard height in px when it overlays the page (iOS Safari),
 * `open` is true whenever a text field is focused on a touch device or the keyboard overlays.
 * Lets fixed bottom UI (chat input, tab bar) stay usable while typing.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const vv = window.visualViewport;
    const update = () => {
      if (!vv) return;
      const h = window.innerHeight - vv.height - vv.offsetTop;
      // Ignore small differences from browser chrome collapsing.
      setInset(h > 120 ? Math.round(h) : 0);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => setTyping(coarse && isTextField(document.activeElement));
    // Enter typing mode at once, but leave it with a delay so a tap that moved focus
    // out of the field still lands on its target before the layout changes.
    const onFocus = () => {
      clearTimeout(timer);
      if (coarse && isTextField(document.activeElement)) setTyping(true);
      else timer = setTimeout(check, 250);
    };
    const onBlur = onFocus;
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      clearTimeout(timer);
    };
  }, []);

  return { inset, open: inset > 0 || typing };
}
