"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export interface Slide {
  id: string;
  imageUrl: string;
  heading: string;
  subtext?: string;
  buttonText?: string;
  buttonHref?: string;
}

interface HeroSliderProps {
  slides: Slide[];
  intervalMs?: number;
}

const HeroSlider: React.FC<HeroSliderProps> = ({ slides, intervalMs = 7000 }) => {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  const goTo = (n: number) =>
    setCurrent(((n % slides.length) + slides.length) % slides.length);
  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(next, intervalMs);
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [current, paused, slides.length, intervalMs]);

  if (!slides.length) return null;

  return (
    <div className="w-full max-w-[1920px] mx-auto">
      <div
        className={`
          relative w-full
          h-[18rem] sm:h-[22rem] md:h-[26rem] lg:h-[30rem] xl:h-[34rem]
          overflow-hidden
        `}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          touchDeltaX.current = 0;
          setPaused(true);
        }}
        onTouchMove={(e) => {
          if (touchStartX.current !== null) {
            touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
          }
        }}
        onTouchEnd={() => {
          setPaused(false);
          if (Math.abs(touchDeltaX.current) > 40) {
            if (touchDeltaX.current > 0) prev();
            else next();
          }
          touchStartX.current = null;
          touchDeltaX.current = 0;
        }}
      >
        {slides.map((s, idx) => {
          const active = idx === current;
          const altText =
            s.heading?.trim() ||
            "Marobi hero banner — premium everyday wear for the modern working woman";

          return (
            <div
              key={s.id}
              className={[
                "absolute inset-0 transition-opacity duration-700 ease-out",
                active ? "opacity-100" : "opacity-0",
              ].join(" ")}
            >
              {/* Optimized hero image */}
              <Image
                src={s.imageUrl}
                alt={altText}
                fill
                priority={idx === 0}
                loading={idx === 0 ? "eager" : "lazy"}
                decoding="async"
                sizes="100vw"
                className="object-cover"
              />

              {/* Rich overlay for readable text on any image */}
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-black/25" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
              </div>

              {/* Content block */}
              <div
                className={[
                  "relative z-20 flex h-full flex-col justify-center",
                  "px-16 sm:px-10 md:px-12 lg:px-24",
                ].join(" ")}
              >
                <div className="max-w-[40rem]">
                  <h1
                    className={[
                      "font-extrabold text-white drop-shadow-lg",
                      "text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight",
                      "tracking-tight",
                    ].join(" ")}
                  >
                    {s.heading}
                  </h1>

                  {s.subtext && (
                    <p
                      className={[
                        "mt-3 md:mt-4",
                        "text-[0.95rem] sm:text-base md:text-lg",
                        "text-white/90 drop-shadow",
                        "max-w-prose",
                      ].join(" ")}
                    >
                      {s.subtext}
                    </p>
                  )}

                  {s.buttonText && s.buttonHref && (
                    <div className="mt-5 md:mt-6">
                      <Link
                        href={s.buttonHref}
                        className={[
                          "inline-flex items-center justify-center",
                          "rounded-full px-6 py-2.5 md:px-7 md:py-3",
                          "font-semibold",
                          "bg-brand text-white",
                          "shadow-[0_8px_20px_-8px_rgba(0,0,0,0.45)]",
                          "ring-1 ring-white/20",
                          "transition-all duration-200",
                          "hover:bg-brand/90 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.5)] active:scale-[0.99]",
                        ].join(" ")}
                      >
                        {s.buttonText}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Prev arrow */}
        <button
          aria-label="Previous"
          onClick={() => {
            if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
            prev();
          }}
          className={[
            "absolute z-30 flex items-center justify-center",
            "top-1/2 -translate-y-1/2",
            "left-2 sm:left-4",
            "h-9 w-9 sm:h-10 sm:w-10 rounded-full",
            "bg-white/80 hover:bg-white shadow-md",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
          ].join(" ")}
        >
          <ChevronLeft className="h-5 w-5 text-gray-900" />
        </button>

        {/* Next arrow */}
        <button
          aria-label="Next"
          onClick={() => {
            if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
            next();
          }}
          className={[
            "absolute z-30 flex items-center justify-center",
            "top-1/2 -translate-y-1/2",
            "right-2 sm:right-4",
            "h-9 w-9 sm:h-10 sm:w-10 rounded-full",
            "bg-white/80 hover:bg-white shadow-md",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
          ].join(" ")}
        >
          <ChevronRight className="h-5 w-5 text-gray-900" />
        </button>

        {/* Indicators */}
        <div className="absolute inset-x-0 bottom-3 sm:bottom-4 z-30 flex items-center justify-center gap-2">
          {slides.map((_, i) => {
            const active = i === current;
            return (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => {
                  if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
                  goTo(i);
                }}
                className={[
                  "h-1.5 rounded-full transition-all duration-300",
                  active ? "w-8 bg-white" : "w-3 bg-white/60 hover:bg-white/80",
                ].join(" ")}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HeroSlider;
