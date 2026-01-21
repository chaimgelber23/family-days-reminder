import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { itemTypeConfig, statusConfig } from "./config";
import type { ScanJobStatus, ItemType } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getItemTypeClass(itemType: ItemType | undefined): string {
  const safeItemType = itemType ?? 'Other';
  return itemTypeConfig[safeItemType] ?? "bg-gray-100 text-gray-800";
}

export function getStatusClasses(status: ScanJobStatus | undefined): { color: string; textColor: string } {
    const safeStatus = status ?? 'Pending';
    return statusConfig[safeStatus] ?? { color: "bg-gray-100", textColor: "text-gray-600" };
}
