"use client";

import Link from "next/link";
import Image from "next/image";
import React from "react";
import {
  FaInstagram,
  FaWhatsapp,
  FaTiktok,
  FaXTwitter,
  FaFacebookF,
} from "react-icons/fa6";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const socials: Array<{
    name: string;
    href: string;
    Icon: React.ComponentType<any>;
    label: string;
    comingSoon?: boolean;
  }> = [
    { name: "Instagram", href: "https://instagram.com/marobi_rtw", Icon: FaInstagram, label: "@marobi_rtw" },
    { name: "TikTok", href: "https://www.tiktok.com/@marobi_rtw", Icon: FaTiktok, label: "@marobi_rtw" },
    { name: "X", href: "https://x.com/marobi_rtw", Icon: FaXTwitter, label: "@marobi_rtw" },
    { name: "Facebook", href: "https://www.facebook.com/share/1a1g2RduqH/?mibextid=wwXIfr", Icon: FaFacebookF, label: "Marobi Online" },
    { name: "WhatsApp", href: "https://wa.me/2347025003685", Icon: FaWhatsapp, label: "WhatsApp" },
  ];

  return (
    <footer className="w-full bg-brand text-white mt-10">
      <div className="mx-auto max-w-[1920px] px-5 md:px-10 lg:px-40 py-10">
        {/* Top: brand + blurb */}
        <div className="space-y-4">
          <Link href="/" aria-label="Marobi home" className="inline-block">
            <Image
              src="/Marobi_Logo_White.svg"
              alt="Marobi — premium fashion & accessories"
              width={240}
              height={36}
              className="h-9 w-auto"
            />
          </Link>

          <p className="text-sm leading-6 text-white/85 max-w-2xl">
          Your Look, Your Power.
          </p>
        </div>

        {/* Divider */}
        <div className="mt-8 border-t border-white/10" />

        {/* Bottom bar */}
        <div className="pt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left */}
          <p className="text-xs text-white/75 text-center md:text-left">
            &copy; {currentYear} Marobi. All rights reserved.
          </p>

          {/* Right (center on mobile, right on desktop) */}
          <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto">
            {/* Socials */}
            <div className="flex items-center justify-center md:justify-end gap-5">
              {socials.map(({ name, href, Icon, label, comingSoon }) => {
                const isPlaceholder = href === "#" || comingSoon;
                const commonClasses =
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-white/15 transition shadow-sm";
                const stateClasses = isPlaceholder
                  ? "bg-white/5 cursor-not-allowed opacity-60"
                  : "bg-white/5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40";
                return isPlaceholder ? (
                  <span
                    key={name}
                    aria-label={`${name} (coming soon)`}
                    title={`${name} — coming soon`}
                    className={`${commonClasses} ${stateClasses}`}
                  >
                    <Icon size={18} />
                  </span>
                ) : (
                  <Link
                    key={name}
                    href={href}
                    aria-label={`${name} ${label}`}
                    title={`${name} ${label}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${commonClasses} ${stateClasses}`}
                  >
                    <Icon size={18} />
                  </Link>
                );
              })}
            </div>

            {/* Links */}
            <nav className="flex flex-wrap items-center justify-center md:justify-end gap-5 text-xs text-white/80 text-center md:text-right">
              <Link
                href="/about-marobi"
                className="hover:text-white/95 underline-offset-2 hover:underline"
              >
                About
              </Link>
              <a
                href="mailto:info@marobionline.com"
                className="hover:text-white/95 underline-offset-2 hover:underline"
              >
                Contact
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
