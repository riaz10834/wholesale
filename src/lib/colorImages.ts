const DEAD = ["1460353581641"];

const NAMED: Record<string, string> = {
  white: "#f4f4f5",
  black: "#171717",
  blue: "#2563eb",
  brown: "#8b5a2b",
  beige: "#e4d0b0",
  gold: "#d4af37",
  silver: "#c0c4c8",
  pearl: "#f3efe6",
  red: "#dc2626",
  green: "#16a34a",
  grey: "#9ca3af",
  gray: "#9ca3af",
  pink: "#ec4899",
  navy: "#1e3a8a",
};

export type ColorWash = {
  filter: string;
  overlay: string | null;
  blend: "color" | "multiply" | "soft-light";
  opacity: number;
};

export function usableImages(images: string[] | null | undefined) {
  return (images || []).filter((src) => src && !DEAD.some((id) => src.includes(id)));
}

/** The shop's own photo. Every colour uses this same picture. */
export function productPhoto(images: string[] | null | undefined) {
  return usableImages(images)[0] || "";
}

export function colorShots(
  product: { images: string[] },
  colors: Array<[string, string | null]>
) {
  const src = productPhoto(product.images);
  if (!colors.length) return src ? [{ color: null as string | null, hex: null as string | null, src }] : [];
  return colors.map(([color, hex]) => ({ color, hex, src }));
}

export function coverSrc(product: { images: string[] }) {
  return productPhoto(product.images) || null;
}

function normalizeHex(hex: string | null | undefined) {
  if (!hex) return null;
  const raw = hex.trim();
  const value = raw.startsWith("#") ? raw.slice(1) : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return `#${value.toLowerCase()}`;
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Recolour the same photo. The shoe does not change, only its colour. */
export function colorWash(color: string | null, hex: string | null): ColorWash | null {
  if (!color) return null;
  const name = color.trim().toLowerCase();
  const tone = normalizeHex(hex) || NAMED[name] || "#64748b";
  const lum = luminance(tone);

  if (name === "white" || lum >= 0.9) {
    return { filter: "grayscale(1) brightness(1.45) contrast(0.92)", overlay: "#ffffff", blend: "soft-light", opacity: 0.45 };
  }
  if (name === "black" || lum <= 0.12) {
    return { filter: "grayscale(1) brightness(0.62) contrast(1.15)", overlay: "#111111", blend: "multiply", opacity: 0.72 };
  }
  if (name === "silver" || name === "grey" || name === "gray") {
    return { filter: "grayscale(1) contrast(1.05) brightness(1.05)", overlay: null, blend: "color", opacity: 0 };
  }
  return { filter: "contrast(1.04) saturate(0.15)", overlay: tone, blend: "color", opacity: 0.92 };
}
