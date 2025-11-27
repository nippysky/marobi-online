"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search as SearchIcon, PencilRuler, UserRound, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SizeChartModal } from "../SizeChartModal";
import { useSizeChart } from "@/lib/context/sizeChartcontext";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import MobileMenuSheet from "./mobile-menu-sheet";
import SearchBar from "../SearchBar";

import type { Category } from "@/lib/categories";
import { CurrencySelector } from "./currency-selector";
import { CartSheet } from "./cart-sheet";

import { useCategories } from "@/lib/hooks/useCategories";
import { FuturisticSkeleton } from "../FuturisticSkeleton";
import { useAuthSession } from "@/lib/hooks/useAuthSession";

// =====================
// UI TUNABLES (adjust here later)
// =====================
const LOGO = {
  collapsedPx: 48,      // icon size in collapsed header
  expandedHeightPx: 50, // wordmark height in expanded header
  expandedWidthPx: 300, // wordmark width (optional)
};

const COLLAPSED_NAV_OFFSET = {
  base: "ml-6",
  lg: "lg:ml-10",
  xl: "xl:ml-16",
};

const linkBaseClasses =
  "tracking-widest font-bold uppercase py-1 px-3 rounded-full transition duration-300 ease-in-out";

// =====================
// Brand Components
// =====================
const BrandIcon: React.FC = () => {
  const s = LOGO.collapsedPx;
  return (
    <div className="shrink-0" style={{ width: s, height: s }}>
      <Image
        src="/Marobi_Icon.svg"
        alt="Marobi icon"
        width={s}
        height={s}
        priority
        className="w-full h-full"
      />
    </div>
  );
};

const BrandWordmark: React.FC = () => {
  const h = LOGO.expandedHeightPx;
  const w = LOGO.expandedWidthPx;
  return (
    <div className="shrink-0" style={{ height: h }}>
      <Image
        src="/Marobi_Logo.svg"
        alt="Marobi — premium fashion & accessories"
        width={w}
        height={h}
        priority
        className="h-[inherit] w-auto"
      />
    </div>
  );
};

// =====================
// Utilities
// =====================
const useOnClickOutside = (
  refs: Array<React.RefObject<HTMLElement | null>>,
  handler: () => void
) => {
  useEffect(() => {
    function listener(e: MouseEvent) {
      const t = e.target as Node;
      const inside = refs.some((r) => r.current && r.current.contains(t));
      if (!inside) handler();
    }
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [refs, handler]);
};

// =====================
// Collapsed Search (popover desktop / sheet mobile)
// =====================
const CollapsedSearch: React.FC<{
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>; // <-- type fixed
}> = ({ open, onClose, anchorRef }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus the SearchBar's input shortly after open (works without modifying SearchBar)
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('input[aria-label="Search products"]');
      el?.focus();
    }, 10);
    return () => clearTimeout(id);
  }, [open]);

  // Desktop click-outside (keep mobile open until explicit close)
  useOnClickOutside([panelRef, anchorRef as unknown as React.RefObject<HTMLElement | null>], () => {
    if (window.innerWidth >= 1024) onClose();
  });

  const desktopVariants = {
    hidden: { opacity: 0, y: -6, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.15 } },
    exit: { opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } },
  };

  const mobileVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
    exit: { opacity: 0, y: 16, transition: { duration: 0.15 } },
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Desktop/Tablet popover (lg and up) */}
          <motion.div
            role="dialog"
            aria-label="Search products"
            ref={panelRef}
            variants={desktopVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            id="collapsed-search-popover"
            className="hidden lg:block absolute z-[60] mt-2 w-[520px] max-w-[80vw]"
            style={{ right: 120 }} // adjust if you want it closer/further from the right edge
          >
            <div className="rounded-2xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 p-3">
              <SearchBar className="w-full" />
            </div>
          </motion.div>

          {/* Mobile full-screen sheet */}
          <motion.div
            className="lg:hidden fixed inset-0 z-[70] flex flex-col bg-white"
            role="dialog"
            aria-modal="true"
            aria-label="Search products"
            variants={mobileVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <SearchIcon className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Search</span>
              </div>
              <button
                aria-label="Close search"
                className="p-2 rounded hover:bg-gray-100"
                onClick={onClose}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3">
              <SearchBar className="w-full" />
            </div>
          </motion.div>

          {/* Mobile backdrop */}
          <AnimatePresence>
            {open && (
              <motion.div
                className="lg:hidden fixed inset-0 z-[60] bg-black/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};

// =====================
// Header
// =====================
export const Header: React.FC = () => {
  const pathname = usePathname() || "/";
  const { openSizeChart } = useSizeChart();
  const { session, status, isCustomer } = useAuthSession();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedSearchOpen, setCollapsedSearchOpen] = useState(false);
  const collapsedSearchBtnRef = useRef<HTMLButtonElement | null>(null); // <-- type matches prop

  const {
    data: categories = [],
    isLoading: categoriesLoading,
    isError,
  } = useCategories();

  const navItems = useMemo<{ label: string; href: string }[]>(
    () => [
      { label: "Home", href: "/" },
      { label: "About Marobi", href: "/about-marobi" },
      { label: "All Products", href: "/all-products" },
      ...categories.map((cat: Category) => ({
        label: cat.name,
        href: `/categories/${cat.slug}`,
      })),
    ],
    [categories]
  );

  useEffect(() => {
    const onScroll = () => setIsCollapsed(window.scrollY > 2);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function renderNavItems(isCompact = false) {
    if (categoriesLoading) {
      return <FuturisticSkeleton count={isCompact ? 3 : 5} height={28} />;
    }
    if (isError) {
      return (
        <div className="flex items-center space-x-2 text-sm text-red-500">
          <span>Failed to load categories</span>
        </div>
      );
    }
    return (
      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
        {navItems.map((item, i) => {
          const active = pathname === item.href;
          return (
            <motion.li
              key={item.href}
              className="list-none"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0, y: 6 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.25, delay: 0.04 * i },
                },
              }}
            >
              <Link
                href={item.href}
                className={`${linkBaseClasses} text-[0.8rem] text-gray-700 hover:bg-brand hover:text-white ${
                  active ? "bg-brand text-white" : ""
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </motion.li>
          );
        })}
      </ul>
    );
  }

  const UserIndicator: React.FC = () => {
    if (status === "loading") {
      return <Skeleton className="h-8 w-8 rounded-full" />;
    }
    if (session && isCustomer) {
      const name = session.user.name || "Account";
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/account"
              className="flex items-center p-2 text-gray-600 hover:text-gray-800 rounded"
              aria-label="Account"
            >
              <UserRound className="w-5 h-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p className="whitespace-nowrap">{name}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/auth/login"
            className="p-2 text-gray-600 hover:text-gray-800 rounded"
            aria-label="Login"
          >
            <UserRound className="w-5 h-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>Login to your account</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Animations
  const headerVariants = {
    expanded: { height: "auto", backgroundColor: "#ffffff" },
    collapsed: { height: "4rem", backgroundColor: "#ffffff" },
  };
  const logoTextVariants = {
    expanded: { opacity: 1, x: 0, transition: { duration: 0.2 } },
    collapsed: { opacity: 0, x: -20, transition: { duration: 0.2 } },
  };
  const logoIconVariants = {
    expanded: { opacity: 0, x: 20, transition: { duration: 0.2 } },
    collapsed: { opacity: 1, x: 0, transition: { duration: 0.2 } },
  };
  const searchInputVariants = {
    expanded: { opacity: 1, width: "40vw", transition: { duration: 0.3 } },
    collapsed: { opacity: 0, width: 0, transition: { duration: 0.2 } },
  };
  const topNavVariants = {
    expanded: {
      height: "auto",
      opacity: 1,
      y: 0,
      transition: { duration: 0.2 },
      display: "block",
    },
    collapsed: {
      height: 0,
      opacity: 0,
      y: -20,
      transition: { duration: 0.2 },
      transitionEnd: { display: "none" as const },
    },
  };

  return (
    <>
      <motion.header
        className="sticky top-0 inset-x-0 z-50 border-b border-gray-200 bg-white md:px-10 px-5"
        variants={headerVariants}
        animate={isCollapsed ? "collapsed" : "expanded"}
        initial="expanded"
        transition={{ type: "tween", duration: 0.2, ease: "easeInOut" }}
      >
        <div className="relative w-full max-w-[1920px] mx-auto">
          {/* Desktop */}
          <div className="hidden lg:block">
            {/* Collapsed */}
            <motion.div
              className={`${isCollapsed ? "flex" : "hidden"} items-center justify-between h-16`}
              initial={false}
              animate={isCollapsed ? "collapsed" : "expanded"}
            >
              <div className="flex items-center">
                <motion.div
                  variants={logoIconVariants}
                  initial="expanded"
                  animate={isCollapsed ? "collapsed" : "expanded"}
                  className="flex items-center pr-2"
                >
                  <Link href="/" aria-label="Marobi home">
                    <BrandIcon />
                  </Link>
                </motion.div>

                <div
                  className={`relative flex items-center space-x-3 ${COLLAPSED_NAV_OFFSET.base} ${COLLAPSED_NAV_OFFSET.lg} ${COLLAPSED_NAV_OFFSET.xl}`}
                >
                  {categoriesLoading ? (
                    <FuturisticSkeleton count={3} height={24} />
                  ) : (
                    navItems.map((item) => {
                      const active = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`${linkBaseClasses} text-[0.75rem] text-gray-700 hover:bg-brand hover:text-white ${
                            active ? "bg-brand text-white" : ""
                          }`}
                          aria-current={active ? "page" : undefined}
                        >
                          {item.label}
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="relative flex items-center space-x-6">
                <CurrencySelector />

                {/* Trigger (desktop collapsed) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      ref={collapsedSearchBtnRef}
                      onClick={() => setCollapsedSearchOpen((s) => !s)}
                      className="text-gray-600 hover:text-gray-800 p-2"
                      aria-expanded={collapsedSearchOpen}
                      aria-controls="collapsed-search-popover"
                      aria-label="Search products"
                    >
                      <SearchIcon className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Search Products</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={openSizeChart}
                      className="text-gray-600 hover:text-gray-800 p-2"
                      aria-label="View size chart"
                    >
                      <PencilRuler className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Size Chart</p>
                  </TooltipContent>
                </Tooltip>

                <UserIndicator />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <CartSheet />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Cart</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </motion.div>

            {/* Expanded */}
            <motion.div className={`${isCollapsed ? "hidden" : "block"}`}>
              <div className="grid grid-cols-3 items-center h-16">
                <motion.div
                  variants={logoTextVariants}
                  initial="expanded"
                  animate={isCollapsed ? "collapsed" : "expanded"}
                  className="flex items-center"
                >
                  <Link href="/" aria-label="Marobi home">
                    <BrandWordmark />
                  </Link>
                </motion.div>

                <div className="flex justify-center">
                  <motion.div
                    className="w-full max-w-lg"
                    variants={searchInputVariants}
                    initial="expanded"
                    animate={isCollapsed ? "collapsed" : "expanded"}
                  >
                    <SearchBar />
                  </motion.div>
                </div>

                <div className="flex items-center justify-end space-x-6">
                  <CurrencySelector />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={openSizeChart}
                        className="text-gray-600 hover:text-gray-800 p-2"
                        aria-label="View size chart"
                      >
                        <PencilRuler className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Size Chart</p>
                    </TooltipContent>
                  </Tooltip>

                  <UserIndicator />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <CartSheet />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Cart</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <motion.nav
                aria-label="Main navigation"
                className="mt-5 overflow-hidden"
                variants={topNavVariants}
                initial="expanded"
                animate={isCollapsed ? "collapsed" : "expanded"}
              >
                <div className="py-5 flex justify-center">{renderNavItems(false)}</div>
              </motion.nav>
            </motion.div>
          </div>

          {/* Mobile */}
          <div className="flex lg:hidden items-center justify-between h-16">
            <Link href="/" aria-label="Marobi home">
              <BrandIcon />
            </Link>
            <div className="flex items-center space-x-2">
              <CurrencySelector />

              {/* Trigger (mobile) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setCollapsedSearchOpen(true)}
                    className="text-gray-600 hover:text-gray-800 p-2"
                    aria-label="Search products"
                  >
                    <SearchIcon className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search Products</p>
                </TooltipContent>
              </Tooltip>

              <CartSheet />
              <MobileMenuSheet />
            </div>
          </div>

          {/* Render the popover/sheet ONCE here so it's available to both desktop & mobile */}
          <CollapsedSearch
            open={collapsedSearchOpen}
            onClose={() => setCollapsedSearchOpen(false)}
            anchorRef={collapsedSearchBtnRef}
          />
        </div>
      </motion.header>

      <SizeChartModal />
    </>
  );
};

export default Header;
