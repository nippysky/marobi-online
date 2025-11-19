
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="h-screen w-screen flex flex-col justify-center items-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 px-4">
      <AlertTriangle className="text-[6rem] text-gray-400 dark:text-gray-600" />
      <h1 className="mt-6 text-6xl font-extrabold text-gray-900 dark:text-gray-100">
        404
      </h1>
      <p className="mt-4 text-2xl text-gray-700 dark:text-gray-300">
        Oops! Page Not Found
      </p>
      <p className="mt-2 text-center text-gray-600 dark:text-gray-400 max-w-md">
        The page you’re looking for doesn’t exist or has been moved. Let’s get you back home.
      </p>
      <Link href="/" className="mt-8">
        <Button size="lg">Go back home</Button>
      </Link>
    </div>
  );
}
