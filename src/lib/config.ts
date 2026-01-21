import type { ScanJobStatus } from './types';

export const statusConfig: Record<ScanJobStatus, { color: string; textColor: string; }> = {
  Pending: { color: "bg-gray-100", textColor: "text-gray-600" },
  Processing: { color: "bg-blue-100", textColor: "text-blue-600" },
  'In Progress': { color: "bg-blue-100", textColor: "text-blue-600" },
  'Awaiting Reports': { color: "bg-yellow-100", textColor: "text-yellow-600" },
  'Awaiting Assignment': { color: "bg-orange-100", textColor: "text-orange-600" },
  'Awaiting Report': { color: "bg-yellow-100", textColor: "text-yellow-600" },
  Complete: { color: "bg-green-100", textColor: "text-green-600" },
  Error: { color: "bg-red-100", textColor: "text-red-600" },
};

export const itemTypeConfig: Record<string, string> = {
    Tefillin: "bg-blue-100 text-blue-800",
    Mezuzah: "bg-purple-100 text-purple-800",
    Torah: "bg-red-100 text-red-800",
    Other: "bg-gray-100 text-gray-800",
};
