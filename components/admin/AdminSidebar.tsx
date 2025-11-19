"use client";

import { ReactNode, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  Boxes,
  Users,
  Settings,
  LogOut,
  NotebookPen,
  User,
  Rows4,
} from "lucide-react";
import { BsBag } from "react-icons/bs";
import { RiAdminLine } from "react-icons/ri";
import { ScrollArea } from "@/components/ui/scroll-area";
import { signOut } from "next-auth/react";

const navItems = [
  { name: "Dashboard",           href: "/admin",                   icon: <LayoutDashboard size={20} /> },
  { name: "Log Offline Sale",    href: "/admin/log-sale",          icon: <NotebookPen size={20} /> },
  { name: "Categories",          href: "/admin/categories",          icon: <Rows4 size={20} /> },
  { name: "Products Management", href: "/admin/product-management", icon: <Boxes size={20} /> },
  { name: "Order Inventory",     href: "/admin/order-inventory",   icon: <BsBag size={20} /> },
  { name: "Customers",           href: "/admin/customers",         icon: <Users size={20} /> },
  { name: "Staff & Admin",       href: "/admin/staff-admins",      icon: <RiAdminLine size={20} /> },
  { name: "Store Settings",      href: "/admin/settings",          icon: <Settings size={20} /> },
];

export default function AdminSidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = useMemo(
    () => (href: string) =>
      href === "/admin"
        ? pathname === href
        : pathname === href || pathname.startsWith(href + "/"),
    [pathname]
  );

  const linkClasses = (href: string) => {
    const active = isActive(href);
    return [
      "flex items-center space-x-3 px-4 py-2 rounded-md transition",
      active ? "bg-white text-brand" : "hover:bg-white hover:text-brand",
    ].join(" ");
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Mobile header */}
      <header className="md:hidden bg-brand text-white flex items-center justify-between px-4 py-3">
        <button onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={24} />
        </button>
        <span className="font-bold text-lg">Marobi Admin</span>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-80 bg-brand text-white">
        <ScrollArea className="h-full flex flex-col">
          <div className="px-6 py-4 font-bold text-xl tracking-wide">
            Marobi Admin
          </div>
          <nav
            className="flex-1 overflow-y-auto px-6 space-y-7 mt-10"
            aria-label="Main navigation"
          >
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={linkClasses(item.href)}
                  aria-current={active ? "page" : undefined}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
          <div className="px-6 py-4 border-t border-white/20 mt-10 space-y-2">
            {/* Profile Link */}
            <Link
              href="/admin/profile"
              className="flex items-center space-x-3 px-4 py-2 rounded-md hover:bg-white hover:text-brand w-full text-left"
            >
              <User size={20} />
              <span>Profile</span>
            </Link>
            {/* Log Out */}
            <button
              onClick={() => signOut({ callbackUrl: "/admin-login" })}
              className="flex items-center space-x-3 px-4 py-2 rounded-md hover:bg-white hover:text-brand w-full text-left mt-5"
            >
              <LogOut size={20} />
              <span>Log out</span>
            </button>
          </div>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-white p-4 md:p-5">
        {children}
      </main>

      {/* Mobile overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 w-80 bg-brand text-white z-40 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4">
              <span className="font-bold text-xl">Marobi Admin</span>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X size={24} />
              </button>
            </div>
            <ScrollArea className="px-6 flex-1">
              <nav className="space-y-4 py-4" aria-label="Mobile navigation">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={linkClasses(item.href)}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.icon}
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </ScrollArea>
            <div className="px-6 py-4 border-t border-white/20 space-y-2">
              <Link
                href="/admin/profile"
                onClick={() => setOpen(false)}
                className="flex items-center space-x-3 px-4 py-2 rounded-md hover:bg-white hover:text-brand w-full text-left"
              >
                <User size={20} />
                <span>My Profile</span>
              </Link>
              <button
                onClick={() => {
                  signOut({ callbackUrl: "/admin-login" });
                  setOpen(false);
                }}
                className="flex items-center space-x-3 px-4 py-2 rounded-md hover:bg-white hover:text-brand w-full text-left"
              >
                <LogOut size={20} />
                <span>Log out</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
