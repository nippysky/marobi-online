// app/account/AccountSidebar.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, Package, Heart, LogOut as LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "react-hot-toast";
import { useAuthSession } from "@/lib/hooks/useAuthSession";

const menu = [
  { label: "Profile", href: "/account", icon: User },
  { label: "Orders", href: "/account/orders", icon: Package },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart },
];

export default function AccountSidebar() {
  const path = usePathname();
  const router = useRouter();
  const { status, isCustomer, signOutCustomer, signOutAdmin } = useAuthSession();
  const [loggingOut, setLoggingOut] = useState(false);

  // If somehow a non-customer lands here, kick them back to login
  useEffect(() => {
    if (status === "authenticated" && !isCustomer) {
      router.push("/auth/login");
    }
  }, [status, isCustomer, router]);

  const handleSignOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      if (isCustomer) {
        await signOutCustomer();
      } else {
        await signOutAdmin();
      }
    } catch {
      toast.error("Failed to log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <nav className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-md space-y-4">
        {menu.map(({ label, href, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition
                ${active
                  ? "bg-gradient-to-r from-brand to-green-700 text-white"
                  : "text-gray-700 hover:bg-gray-100"}
              `}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
        <Button
          variant="destructive"
          className="mt-6 w-full flex items-center justify-center gap-2"
          onClick={handleSignOut}
          disabled={loggingOut}
        >
          <LogOutIcon className="w-5 h-5" />
          {loggingOut ? "Logging out..." : "Logout"}
        </Button>
      </nav>
    </>
  );
}
