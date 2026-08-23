import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCurrencySymbol(currency?: string | null): string {
  if (!currency) return "₹"
  const c = currency.trim().toUpperCase()
  if (c === "INR" || c === "RS" || c === "RS." || c === "RUPEES" || c === "RUPEE" || c === "₹") return "₹"
  if (c === "USD" || c === "$") return "$"
  if (c === "EUR" || c === "€") return "€"
  if (c === "GBP" || c === "£") return "£"
  if (c === "JPY" || c === "¥") return "¥"
  if (c === "AED") return "AED "
  if (c === "CAD" || c === "CA$") return "CA$"
  if (c === "AUD" || c === "A$") return "A$"
  return "₹"
}

export function formatCurrency(
  amount: number | string | undefined | null,
  currency: string = "INR"
): string {
  const num = Number(amount || 0)
  const sym = getCurrencySymbol(currency)
  return `${sym}${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
