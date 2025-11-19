
"use client";

import React, { useState, useEffect } from "react";
import { FaArrowUp } from "react-icons/fa6";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let throttleTimeout: number | null = null;

    const handleScroll = () => {
      if (throttleTimeout !== null) return;
      throttleTimeout = window.setTimeout(() => {
        setVisible(window.pageYOffset > 300);
        if (throttleTimeout !== null) {
          clearTimeout(throttleTimeout);
          throttleTimeout = null;
        }
      }, 150);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // check on mount
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (throttleTimeout !== null) {
        clearTimeout(throttleTimeout);
      }
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className="fixed bottom-6 right-6 p-3 bg-brand hover:bg-brand-dark text-white rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand transition"
    >
      <FaArrowUp size={20} />
    </button>
  );
}
