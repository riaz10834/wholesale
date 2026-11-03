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
