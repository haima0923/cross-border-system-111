import { useState, useRef, useEffect, useCallback } from 'react';
import { Package } from 'lucide-react';

const SIZE_MAP = {
  sm: { outer: 'w-8 h-8',   rounded: 'rounded',    icon: 12, popSize: 200 },
  md: { outer: 'w-10 h-10', rounded: 'rounded-lg',  icon: 16, popSize: 220 },
  lg: { outer: 'w-14 h-14', rounded: 'rounded-xl',  icon: 22, popSize: 240 },
  xl: { outer: 'w-20 h-20', rounded: 'rounded-xl',  icon: 28, popSize: 240 },
} as const;

interface ProductImageProps {
  hostedImageUrl?: string | null;
  imageUrl?: string | null;
  size?: keyof typeof SIZE_MAP;
  className?: string;
  alt?: string;
  withHover?: boolean;
}

export function ProductImage({
  hostedImageUrl,
  imageUrl,
  size = 'md',
  className,
  alt = '',
  withHover = true,
}: ProductImageProps) {
  const primarySrc  = hostedImageUrl || null;
  const fallbackSrc = imageUrl || null;

  const [src, setSrc]             = useState<string | null>(primarySrc ?? fallbackSrc);
  const [triedPrimary, setTriedPrimary] = useState(false);
  const [failed, setFailed]       = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef     = useRef<ReturnType<typeof setTimeout>>();
  const [popover, setPopover]     = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const next = (hostedImageUrl || null) ?? (imageUrl || null);
    setSrc(next);
    setTriedPrimary(false);
    setFailed(false);
  }, [hostedImageUrl, imageUrl]);

  const handleError = useCallback(() => {
    if (!triedPrimary && fallbackSrc && fallbackSrc !== src) {
      setTriedPrimary(true);
      setSrc(fallbackSrc);
    } else {
      setFailed(true);
      setSrc(null);
    }
  }, [triedPrimary, fallbackSrc, src]);

  const handleMouseEnter = useCallback(() => {
    if (!withHover || !src || failed) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const rect    = el.getBoundingClientRect();
      const cfg     = SIZE_MAP[size];
      const popSize = cfg.popSize;
      const gap     = 10;

      let x = rect.right + gap;
      if (x + popSize > window.innerWidth - 8) {
        x = rect.left - popSize - gap;
      }
      if (x < 8) {
        x = Math.max(8, rect.left + rect.width / 2 - popSize / 2);
      }

      let y = rect.top;
      if (y + popSize > window.innerHeight - 8) {
        y = window.innerHeight - popSize - 8;
      }
      if (y < 8) y = 8;

      setPopover({ x, y });
    }, 180);
  }, [withHover, src, failed, size]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setPopover(null);
  }, []);

  const cfg        = SIZE_MAP[size];
  const outerClass = className
    ?? `${cfg.outer} ${cfg.rounded} flex-shrink-0`;
  const hasImage   = !failed && !!src;

  return (
    <>
      <div
        ref={containerRef}
        className={`relative overflow-hidden bg-slate-100 flex items-center justify-center ${outerClass}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {hasImage ? (
          <img
            src={src!}
            alt={alt}
            className="w-full h-full object-cover"
            onError={handleError}
          />
        ) : (
          <Package size={cfg.icon} className="text-slate-300" />
        )}
      </div>

      {popover && hasImage && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: popover.x, top: popover.y }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
            style={{ width: cfg.popSize, height: cfg.popSize }}
          >
            <img
              src={src!}
              alt={alt}
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
