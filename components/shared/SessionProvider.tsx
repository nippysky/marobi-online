"use client";

import { SessionProvider } from "next-auth/react";
import React, { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function NextAuthSessionProvider({ children }: Props) {
  return (
    <SessionProvider
      basePath="/api/auth"            // always talk to your single [...nextauth] route
      refetchInterval={0}             // never poll in the background
      refetchOnWindowFocus={false}    // and don’t refetch when the window regains focus
    >
      {children}
    </SessionProvider>
  );
}
