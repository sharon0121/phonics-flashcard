interface HeroMascotProps {
  src: string;
  alt: string;
}

// A cut-out (background-removed) hero peeking up from the corner as a page
// mascot. Fixed + low z-index + pointer-events-none so it never sits above
// or blocks any real content; opaque card/text backgrounds naturally paint
// over it wherever they'd overlap. Height is capped to a share of the
// viewport (not just a fixed px value) so on short windows it shrinks
// instead of having its head clipped off above the top of the screen.
export default function HeroMascot({ src, alt }: HeroMascotProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      aria-hidden="true"
      className="pointer-events-none fixed right-2 bottom-0 z-0 hidden h-[85vh] max-h-[900px] w-auto select-none drop-shadow-2xl sm:block"
    />
  );
}
