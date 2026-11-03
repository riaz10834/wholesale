const crop = "?auto=format&fit=crop&w=900&q=80";
const photo = (id: string) => `https://images.unsplash.com/photo-${id}${crop}`;

/** One real photo per colour. The picture itself is that colour, not a tint over the screen. */
const COLOR_PHOTOS: Record<string, Record<string, string>> = {
  "running-sneakers": {
    White: photo("1608231387042-66d1773070a5"),
    Blue: photo("1515955656352-a1fa3ffcd111"),
    Black: photo("1491553895911-0055eca6402d"),
  },
  "women-block-heel-sandals": {
    Beige: photo("1535043934128-cf0b28d52f95"),
    Black: photo("1582897085656-c636d006a246"),
  },
  "men-leather-oxford-shoes": {
    Black: photo("1576133384936-ea17c54e9fd4"),
    Brown: photo("1614252235316-8c857d38b5f4"),
  },
};

const DEAD = ["1460353581641"];

export function usableImages(images: string[] | null | undefined) {
  return (images || []).filter((src) => src && !DEAD.some((id) => src.includes(id)));
}

export function colorShots(
  product: { slug: string; images: string[] },
  colors: Array<[string, string | null]>
) {
  const stored = usableImages(product.images);
  const fills = COLOR_PHOTOS[product.slug];
  const ownUploads = stored.some((src) => !src.includes("images.unsplash.com"));
  if (!colors.length) {
    return stored.map((src) => ({ color: null as string | null, hex: null as string | null, src }));
  }
  return colors.map(([color, hex], i) => ({
    color,
    hex,
    src: (ownUploads ? stored[i] : undefined) || fills?.[color] || stored[i] || stored[0] || "",
  }));
}

export function productColors(product: {
  product_variants?: { is_active: boolean; color: string | null; color_hex: string | null }[] | null;
}) {
  const seen = new Map<string, string | null>();
  for (const variant of product.product_variants || []) {
    if (variant.is_active && variant.color && !seen.has(variant.color)) seen.set(variant.color, variant.color_hex);
  }
  return Array.from(seen.entries());
}

export function colorListings<T extends { id: string; product_variants?: { is_active: boolean; color: string | null; color_hex: string | null }[] | null }>(
  products: T[]
) {
  const rows: { product: T; color: string | null; hex: string | null; key: string }[] = [];
  for (const product of products) {
    const colors = productColors(product);
    if (!colors.length) rows.push({ product, color: null, hex: null, key: product.id });
    else for (const [color, hex] of colors) rows.push({ product, color, hex, key: `${product.id}:${color}` });
  }
  return rows;
}

export function coverSrc(product: { slug: string; images: string[] }) {
  const stored = usableImages(product.images);
  const fills = COLOR_PHOTOS[product.slug];
  const ownUploads = stored.some((src) => !src.includes("images.unsplash.com"));
  if (!ownUploads && fills) {
    const first = Object.values(fills)[0];
    if (first) return first;
  }
  return stored[0] || null;
}
