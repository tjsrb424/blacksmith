"use client";

import { memo, useState } from "react";
import { getWeaponFallbackImagePath } from "@/data/assets";
import { cn } from "@/lib/cn";

type WeaponImageProps = {
  src: string;
  alt: string;
  className?: string;
};

function WeaponImageInner({ src, alt, className }: WeaponImageProps) {
  const fallback = getWeaponFallbackImagePath();
  const [current, setCurrent] = useState(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("select-none", className)}
      onDragStart={(e) => e.preventDefault()}
      onError={() => {
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}

/**
 * 무기 PNG가 없으면 자동으로 공용 SVG 플레이스홀더로 대체
 */
export const WeaponImage = memo(function WeaponImage(props: WeaponImageProps) {
  return <WeaponImageInner key={props.src} {...props} />;
});
