import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}




// 80 mm‑wide receipt print CSS
export const receiptCSS = `
  @page { size: 80mm auto; margin: 0; }
  body { width: 80mm; font-family: monospace; margin:0; padding:4mm; }
  .header, .footer { text-align: center; margin-bottom:4mm; }
  .line { display:flex; justify-content:space-between; margin-bottom:2mm; }
  .total { font-weight:bold; display:flex; justify-content:space-between; margin-top:4mm; }
  .small { font-size:0.8em; }
`;