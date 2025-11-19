"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose, // close sheet on link click
} from "@/components/ui/sheet";
import { AlignJustify, PencilRuler, UserRound, LogOut } from "lucide-react";
import { useSizeChart } from "@/lib/context/sizeChartcontext";
import { useSession, signOut } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import type { Category } from "@/lib/categories";
import clsx from "clsx";

export const MobileMenuSheet: React.FC<{ tone?: "light" | "dark" }> = ({ tone = "dark" }) => {
  const pathname = usePathname() || "/";
  const { openSizeChart } = useSizeChart();
  const { data: session, status } = useSession();

  const {
    data: categories = [],
    isLoading: categoriesLoading,
  } = useQuery<Category[], Error>({
    queryKey: ["categories"],
    queryFn: () =>
      fetch("/api/categories").then((res) => {
        if (!res.ok) throw new Error("Failed to load categories");
        return res.json() as Promise<Category[]>;
      }),
    staleTime: 300_000,
  });

  // Top-level + dynamic categories
  const navItems: { label: string; href: string }[] = [
    { label: "Home", href: "/" },
    { label: "About Marobi", href: "/about-marobi" }, // “About Us”
    { label: "All Products", href: "/all-products" },
    ...categories.map((cat) => ({ label: cat.name, href: `/categories/${cat.slug}` })),
  ];

  const triggerClass = clsx(
    "w-5 h-5 cursor-pointer",
    tone === "light" ? "text-white" : "text-gray-600 dark:text-gray-300"
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <AlignJustify className={triggerClass} aria-label="Open menu" />
      </SheetTrigger>

      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        <nav className="mt-8 px-4 space-y-6">
          {categoriesLoading ? (
            <>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </>
          ) : (
            navItems.map(({ label, href }) => {
              const isActive = pathname === href;
              return (
                <SheetClose asChild key={href}>
                  <Link
                    href={href}
                    className={clsx(
                      "block text-base font-medium text-gray-700 dark:text-gray-300 hover:underline",
                      isActive && "underline font-semibold"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {label}
                  </Link>
                </SheetClose>
              );
            })
          )}
        </nav>

        <div className="my-8 border-t border-gray-200 dark:border-gray-700" />

        <div className="px-4 space-y-6">
          {status === "loading" ? (
            <Skeleton className="h-8 w-32" />
          ) : !session ? (
            <SheetClose asChild>
              <Link
                href="/auth/login"
                className="flex w-full items-center space-x-2 text-gray-700 dark:text-gray-300 hover:underline"
              >
                <UserRound className="w-5 h-5" />
                <span>Login</span>
              </Link>
            </SheetClose>
          ) : (
            <>
              <SheetClose asChild>
                <Link
                  href="/account"
                  className="flex w-full items-center space-x-2 text-gray-700 dark:text-gray-300 hover:underline"
                >
                  <UserRound className="w-5 h-5" />
                  <span>Profile</span>
                </Link>
              </SheetClose>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex w-full items-center space-x-2 text-gray-700 dark:text-gray-300 hover:underline"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </>
          )}

          <button
            onClick={openSizeChart}
            className="flex w-full items-center space-x-2 text-gray-700 dark:text-gray-300 hover:underline"
          >
            <PencilRuler className="w-5 h-5" />
            <span>Size Chart</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenuSheet;
