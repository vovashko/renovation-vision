// Small string helpers used for storage keys and file names.

/** Lowercase, hyphenated, at most 24 characters: "Living Room" → "living-room". Never empty. */
export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 24) || "item"
  );
}

/** Lowercased file extension, defaulting to "jpg". */
export function fileExt(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "jpg";
}
