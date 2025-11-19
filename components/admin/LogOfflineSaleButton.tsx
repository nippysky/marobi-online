"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BsBag } from "react-icons/bs";

export default function LogOfflineSaleButton() {
  return (
    <Link href="/admin/log-sale" className="flex items-center">
      <Button>
        <BsBag className="h-4 w-4 mr-1" />
        Log Offline Sale
      </Button>
    </Link>
  );
}
