"use client";

import React from "react";
import clsx from "clsx";

/**
 * Light futuristic skeleton with shimmer, optimized for white/light backgrounds.
 */
export interface FuturisticSkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  circle?: boolean;
  count?: number;
  style?: React.CSSProperties;
}

const baseStyle: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 9999,
  backgroundColor: "#f0f2f7", // light base to blend on white
};

const shimmerKeyframes = `
@keyframes light-shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}
`;

// Light gradient similar to shadcn/ui skeleton
const gradient = `linear-gradient(
  90deg,
  #f0f2f7 0%,
  #e2e8f0 25%,
  #f5f7fa 50%,
  #e2e8f0 75%,
  #f0f2f7 100%
)`;

function ensureInjected() {
  if (typeof document === "undefined") return;
  if (document.getElementById("futuristic-skeleton-style")) return;
  const style = document.createElement("style");
  style.id = "futuristic-skeleton-style";
  style.textContent = shimmerKeyframes + `
  .futuristic-skeleton {
    background: ${gradient};
    background-size: 400px 100%;
    animation: light-shimmer 1.5s infinite linear;
    border-radius: 9999px;
  }
  `;
  document.head.appendChild(style);
}

export const FuturisticSkeleton: React.FC<FuturisticSkeletonProps> = ({
  width,
  height = 32,
  className = "",
  circle = false,
  count = 1,
  style,
}) => {
  React.useEffect(() => {
    ensureInjected();
  }, []);

  const items = Array.from({ length: count });

  return (
    <div className={clsx("flex gap-3", className)}>
      {items.map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            ...baseStyle,
            width: width ?? (circle ? height : 100),
            height,
            borderRadius: circle ? "50%" : 9999,
            ...style,
          }}
          className="futuristic-skeleton"
        />
      ))}
    </div>
  );
};
