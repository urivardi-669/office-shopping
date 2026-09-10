"use client";

import { useState } from "react";

export default function ProductImage({
  src,
  alt,
  size = 48,
  className = "",
}: {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-neutral-100 text-neutral-300 shrink-0 ${className}`}
        style={{ width: size, height: size }}
        aria-label={alt}
      >
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
          <path d="M21 15l-5-5-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external Tiv Taam CDN images, remote-only, not worth Next/Image config
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className={`rounded-lg object-cover bg-neutral-50 shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
