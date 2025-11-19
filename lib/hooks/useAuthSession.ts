"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export function useAuthSession() {
  const { data: session, status } = useSession({ required: false });
  const loading = status === "loading";

  return {
    session,
    status,
    loading,

    // role flags
    isCustomer: session?.user?.role === "customer",
    isAdmin:    !!session?.user?.role && session.user.role !== "customer",

    // sign‐in helpers default to the correct landing page
    signInCustomer: (
      email: string,
      password: string,
      callbackUrl = "/account"
    ) =>
      signIn("credentials", {
        redirect:    false,
        email,
        password,
        role:        "customer",
        callbackUrl,
        json:        true,
      }),

    signInAdmin: (
      email: string,
      password: string,
      callbackUrl = "/admin"
    ) =>
      signIn("credentials", {
        redirect:    false,
        email,
        password,
        role:        "staff",
        callbackUrl,
        json:        true,
      }),

    // sign‐out helpers
    signOutCustomer: () => signOut({ callbackUrl: "/" }),
    signOutAdmin:    () => signOut({ callbackUrl: "/admin-login" }),
  };
}
