import { colorWash } from "@/lib/colorImages";
import { cn } from "@/lib/utils";

export function ProductColorImage({
  src,
  alt,
  color,
  hex,
  className,
  onError,
}: {
  src: string;
  alt: string;
  color: string | null;
  hex: string | null;
  className?: string;
  onError?: () => void;
}) {
  const wash = colorWash(color, hex);
  return (
    <div className={cn("relative h-full w-full isolate", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onError={onError} className="h-full w-full object-cover" style={wash ? { filter: wash.filter } : undefined} />
      {wash?.overlay ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: wash.overlay, mixBlendMode: wash.blend, opacity: wash.opacity }}
        />
      ) : null}
    </div>
  );
}
