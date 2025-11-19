const hits = new Map<string, { count: number; reset: number }>()
const WINDOW = 60 * 1000   // 1 minute in ms
const LIMIT  = 5           // max requests per WINDOW, per IP

export function rateLimit(ip: string) {
  const now = Date.now()

  // 1) Look up (or create) this IP’s record
  //    - count: how many calls so far in this window
  //    - reset: timestamp when this window expires
  const entry = hits.get(ip) || { count: 0, reset: now + WINDOW }

  // 2) If we’ve passed the reset time, start a fresh window
  if (now > entry.reset) {
    entry.count = 0
    entry.reset = now + WINDOW
  }

  // 3) Record this hit
  entry.count++
  hits.set(ip, entry)

  // 4) Calculate how many are left
  const remaining = LIMIT - entry.count

  // 5) Return:
  //    - ok       → true if count ≤ LIMIT
  //    - remaining→ how many more calls are allowed before blocking
  //    - reset    → when the current window ends (ms since epoch)
  return {
    ok:        remaining >= 0,
    remaining, 
    reset:     entry.reset
  }
}
