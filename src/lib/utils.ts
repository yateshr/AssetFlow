import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "Dell Latitude 5440" from whichever of make and model exist (never the word undefined). */
export const makeModel = (a: { manufacturer?: string; model?: string }) => [a.manufacturer, a.model].filter(Boolean).join(' ');
