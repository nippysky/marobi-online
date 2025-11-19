// app/admin/settings/page.tsx
import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/getAdminSession";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ImageIcon, Ruler } from "lucide-react";

type CardConfig = {
  href: string;
  title: string;
  description: string;
  Icon: React.ElementType;
  accentBg: string;
  accentText: string;
  accentStripe: string;
  accentBgHover: string;
  accentTextHover: string;
};

export default async function StoreSettingsPage() {
  // enforce admin/staff session
  const session = await getAdminSession();
  if (!session || !session.user?.role || session.user.role === "customer") {
    // redirect to admin login (preserve callback to return here)
    const cb = encodeURIComponent("/admin/settings");
    redirect(`/admin-login?callbackUrl=${cb}`);
  }

  const cards: CardConfig[] = [
    {
      href: "/admin/settings/hero-slider",
      title: "Hero Slider",
      description: "Manage homepage carousel images, headlines & CTAs",
      Icon: ImageIcon,
      accentBg: "bg-purple-50",
      accentText: "text-purple-500",
      accentStripe: "bg-purple-500",
      accentBgHover: "group-hover:bg-purple-100",
      accentTextHover: "group-hover:text-purple-600",
    },
    {
      href: "/admin/settings/size-chart",
      title: "Size Chart",
      description: "Edit product size guide: labels & measurements",
      Icon: Ruler,
      accentBg: "bg-teal-50",
      accentText: "text-teal-500",
      accentStripe: "bg-teal-500",
      accentBgHover: "group-hover:bg-teal-100",
      accentTextHover: "group-hover:text-teal-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-10 text-center">
        Store Settings
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {cards.map(
          ({
            href,
            title,
            description,
            Icon,
            accentBg,
            accentText,
            accentStripe,
            accentBgHover,
            accentTextHover,
          }) => (
            <Link key={href} href={href} className="group">
              <Card className="border border-gray-200 rounded-2xl transition-transform transform hover:scale-105 hover:shadow-lg duration-300">
                <CardContent className="p-6 flex flex-col items-center space-y-4">
                  <div
                    className={`${accentBg} p-4 rounded-full transition-colors duration-300 ${accentBgHover}`}
                  >
                    <Icon className={`h-8 w-8 ${accentText}`} />
                  </div>

                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-1 ${accentStripe} rounded mb-2 transition-all duration-300 group-hover:w-12`}
                    />
                    <CardTitle
                      className={`text-xl font-semibold text-gray-900 transition-colors duration-300 ${accentTextHover}`}
                    >
                      {title}
                    </CardTitle>
                  </div>

                  <p className="text-sm text-gray-500 text-center">
                    {description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        )}
      </div>
    </div>
  );
}
