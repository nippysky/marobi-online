// lib/getAdminSession.ts
import { getSharedSession } from "./getSession"

/**
 * Returns the session only if it’s a logged-in staff/admin (role ≠ "customer"), otherwise null.
 */
export async function getAdminSession() {
  const session = await getSharedSession()
  if (!session || session.user.role === "customer") {
    return null
  }
  return session
}
