import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** يدمج فئات Tailwind ويحل التعارض بينها. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
