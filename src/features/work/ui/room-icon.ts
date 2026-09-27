/** A generic room icon by name (spec: chair/countertops/bathtub/bed, a sensible pick otherwise). */
export function roomIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("kitchen")) return "countertops";
  if (n.includes("bath")) return "bathtub";
  if (n.includes("bed")) return "bed";
  if (n.includes("living") || n.includes("dining") || n.includes("lounge") || n.includes("family")) return "chair";
  return "door_front";
}
