// Shared focus-visible outline classes for the rare native <button>/<a> outside the primitives
// that needs one directly (everything else gets it for free from Button, Item, Card interactive,
// etc). Two flavors: `focusRing` sits outside the element's edge (icon buttons, thumbnails);
// `focusRingInset` sits just inside it (elements that already touch a card or list edge).
export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
export const focusRingInset = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";
