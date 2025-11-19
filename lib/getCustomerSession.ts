// lib/getCustomerSession.ts
import { getSharedSession } from "./getSession"

/**
 * Returns the session only if it’s a logged-in customer, otherwise null.
 */
export async function getCustomerSession() {
  const session = await getSharedSession()
  if (!session || session.user.role !== "customer") {
    return null
  }
  return session
}
