"use client";

import { Package, Search, Star, Inbox } from "lucide-react";
import { ReactNode } from "react";

/**
 * iconName options (extend as needed):
 * 'Package' | 'Search' | 'Star' | 'Inbox'
 */
const ICONS: Record<string, any> = { Package, Search, Star, Inbox };

export default function EmptyState({
  iconName = "Inbox",
  title,
  message,
  action,
}: {
  iconName?: keyof typeof ICONS | string;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const Icon = ICONS[iconName] ?? Inbox;
  return (
    <div className="border border-dashed rounded-lg p-12 flex flex-col items-center text-center bg-white">
      <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-6">
        <Icon className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {message && (
        <p className="text-sm text-gray-600 max-w-md mb-6 leading-relaxed">
          {message}
        </p>
      )}
      {action}
    </div>
  );
}
