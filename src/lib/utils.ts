import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function preprocessMarkdown(text: string): string {
  if (!text) return "";
  // Replace \[ ... \] with $$ ... $$
  let processed = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `$$${equation}$$`);
  // Replace \( ... \) with $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => `$${equation}$`);
  return processed;
}
