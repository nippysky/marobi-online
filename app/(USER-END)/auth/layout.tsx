import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import AdCarousel from "@/components/AdCarousel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full">
      {/* Left: fixed, full-screen image (hidden on small screens) */}
      <div className="hidden md:block md:w-1/2 relative">
        <AdCarousel />
      </div>

      {/* Right: scrollable form area */}
      <div className="w-full md:w-1/2">
        <ScrollArea className="h-full">
          <div className="flex min-h-full flex-col items-center justify-center p-8">
            {children}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
