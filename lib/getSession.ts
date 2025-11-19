// lib/getSession.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "./authOptions"

/**
 * Returns the raw NextAuth session (customer or staff).
 */
export async function getSharedSession() {
  return getServerSession(authOptions)
}
