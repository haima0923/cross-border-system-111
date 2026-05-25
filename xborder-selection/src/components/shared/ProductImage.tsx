import { useState, useRef, useEffect, useCallback } from 'react';
import type { SyntheticEvent } from 'react';
import { Package } from 'lucide-react';

const SIZE_MAP = {
  sm: { outer: 'w-8 h-8',   rounded: 'rounded',    icon: 12 },
  md: { outer: 'w-10 h-10', rounded: 'rounded-lg',  icon: 16 },
  lg: { outer: 'w-14 h-14', rounded: 'rounded-xl',  icon: 22 },
  xl: { outer: 'w-20 h-20', rounded: 'rounded-xl',  icon: 28 },
} as const;

interface ProductImageProps {
  hostedImageUrl?: string | null;
  imageUrl?: string | null;
  size?: keyof typeof SIZE_MAP;
  className?: string;
  alt?: string;
  withHover?: boolean;
}

export function HoverZoomImage({
  src,
  alt = '',
  className,
  zoomClassName = 'max-h-[72vh] max-w-[72vw] rounded-xl object-contain',
  onError,
}: {
  src: string;
  alt?: string;
  className: string;
  zoomClassName?: string;
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), 120);
  };

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`${className} cursor-zoom-in transition-transform duration-150 hover:scale-105`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onError={onError}
      />
      {visible && (
        <div className="fixed left-1/2 top-1/2 z-[9999] -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          <img src={src} alt={alt} className={zoomClassName} />
        </div>
      )}
    </>
  );
}

export function ProductImage({
  hostedImageUrl,
  imageUrl,
  size = 'md',
  className,
  alt = '',
  withHover = true,
}: ProductImageProps) {
  // 优先使用hostedImageUrl（GCS代理），其次用image-proxy中转原始URL，最后直接用原始URL
  const proxyUrl = imageUrl ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}` : null;
  const primarySrc  = hostedImageUrl || proxyUrl || null;
  const fallbackSrc = imageUrl || null;

  const [src, setSrc]             = useState<string | null>(primarySrc ?? fallbackSrc);
  const [triedPrimary, setTriedPrimary] = useState(false);
  const [failed, setFailed]       = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const pUrl = imageUrl ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}` : null;
    const next = (hostedImageUrl || null) ?? pUrl ?? (imageUrl || null);
    setSrc(next);
    setTriedPrimary(false);
    setFailed(false);
    setShowPreview(false);
  }, [hostedImageUrl, imageUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowPreview(true), 120);
  }, [withHover, src, failed]);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowPreview(false);
  }, []);

  const cfg        = SIZE_MAP[size];
  const outerClass = className
    ?? `${cfg.outer} ${cfg.rounded} flex-shrink-0`;
  const hasImage   = !failed && !!src;

  return (
    <>
      <div
        className={`relative overflow-hidden bg-slate-100 flex items-center justify-center ${hasImage && withHover ? 'cursor-zoom-in' : ''} ${outerClass}`}
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

      {showPreview && hasImage && withHover && (
        <div className="fixed left-1/2 top-1/2 z-[9999] -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          <img
            src={src!}
            alt={alt}
            className="max-h-[72vh] max-w-[72vw] rounded-xl object-contain"
          />
        </div>
      )}
    </>
  );
}
