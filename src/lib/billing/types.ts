import type { Timestamp } from 'firebase/firestore';
import type { ItemType } from '../types';

// Pricing configuration per item type
export interface PricingConfig {
  itemType: ItemType;
  pricePerScan: number;         // Base price per scan
  minimumCharge?: number;       // Minimum charge per job
  bulkDiscountThreshold?: number; // Number of scans before bulk discount applies
  bulkDiscountPercent?: number;   // Percentage discount for bulk
  currency: 'USD' | 'ILS';
}

// Per-station custom pricing (overrides default pricing)
export interface StationPricing {
  stationId: string;
  stationName?: string;
  customPricing: Partial<Record<ItemType, PricingConfig>>;
  useCustomPricing: boolean;    // If false, uses default pricing
  updatedAt?: Timestamp;
  updatedBy?: string;
  notes?: string;               // Admin notes about pricing agreement
}

// A completed job with billing info (price locked at completion time)
export interface BilledJob {
  id: string;                   // Same as jobId
  jobId: string;
  stationId: string;
  stationName: string;
  jobName?: string;
  clientName: string;
  itemType: ItemType;
  scanCount: number;
  // Price info locked at time of completion
  pricePerScan: number;
  subtotal: number;
  discount: number;
  total: number;
  currency: 'USD' | 'ILS';
  completedAt: Timestamp;
  billedAt: Timestamp;          // When this was added to billing
  // Payment tracking
  isPaid: boolean;
  paidAmount?: number;
  paidAt?: Timestamp;
  paymentNote?: string;
  paymentId?: string;           // Reference to payment record
}

// Payment record - tracks what was paid
export interface Payment {
  id: string;
  stationId: string;
  stationName: string;
  amount: number;
  currency: 'USD' | 'ILS';
  method?: 'cash' | 'check' | 'transfer' | 'card' | 'other';
  reference?: string;           // Check number, transfer ID, etc.
  note?: string;
  // What this payment covers
  appliedToJobs?: {
    jobId: string;
    amount: number;
  }[];
  createdAt: Timestamp;
  createdBy: string;
  createdByName?: string;
}

// Station billing summary
export interface StationBillingSummary {
  stationId: string;
  stationName: string;
  // Totals
  totalBilled: number;          // Sum of all billed jobs
  totalPaid: number;            // Sum of all payments
  balance: number;              // totalBilled - totalPaid (positive = they owe)
  currency: 'USD' | 'ILS';
  // Counts
  totalJobs: number;
  paidJobs: number;
  unpaidJobs: number;
  // Last activity
  lastJobAt?: Timestamp;
  lastPaymentAt?: Timestamp;
  updatedAt: Timestamp;
}

// Invoice (generated document for a station)
export interface Invoice {
  id: string;
  invoiceNumber: string;        // Human readable invoice number
  stationId: string;
  stationName: string;
  // Period covered
  periodStart?: Timestamp;
  periodEnd?: Timestamp;
  // Financial
  lineItems: InvoiceLineItem[];
  subtotal: number;
  totalDiscount: number;
  previousBalance: number;      // Balance carried forward
  paymentsReceived: number;     // Payments during this period
  grandTotal: number;           // What they owe
  currency: 'USD' | 'ILS';
  // Status
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue';
  createdAt: Timestamp;
  createdBy: string;
  sentAt?: Timestamp;
  paidAt?: Timestamp;
  dueDate?: Timestamp;
  notes?: string;
  // Google Sheets sync
  googleSheetRowId?: number;
}

// Invoice line item (one per job)
export interface InvoiceLineItem {
  jobId: string;
  jobName?: string;
  clientName: string;
  itemType: ItemType;
  scanCount: number;
  pricePerScan: number;
  subtotal: number;
  discount: number;
  total: number;
  completedAt: Timestamp;
}

// Google Sheets configuration stored in Firestore
export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  serviceAccountEmail?: string;
  serviceAccountKey?: string;
  lastSyncAt?: Timestamp;
  isEnabled: boolean;
}

// Default pricing (can be overridden per station)
export const DEFAULT_PRICING: Record<ItemType, PricingConfig> = {
  'Tefillin': {
    itemType: 'Tefillin',
    pricePerScan: 2.50,
    minimumCharge: 10,
    currency: 'USD',
  },
  'Mezuzah': {
    itemType: 'Mezuzah',
    pricePerScan: 1.50,
    minimumCharge: 5,
    bulkDiscountThreshold: 50,
    bulkDiscountPercent: 10,
    currency: 'USD',
  },
  'Torah': {
    itemType: 'Torah',
    pricePerScan: 3.00,
    minimumCharge: 50,
    currency: 'USD',
  },
  'Other': {
    itemType: 'Other',
    pricePerScan: 2.00,
    currency: 'USD',
  },
};

// Helper to calculate job total
export function calculateJobTotal(
  scanCount: number,
  pricing: PricingConfig
): { subtotal: number; discount: number; total: number } {
  const subtotal = scanCount * pricing.pricePerScan;
  let discount = 0;

  // Apply bulk discount if applicable
  if (
    pricing.bulkDiscountThreshold &&
    pricing.bulkDiscountPercent &&
    scanCount >= pricing.bulkDiscountThreshold
  ) {
    discount = subtotal * (pricing.bulkDiscountPercent / 100);
  }

  let total = subtotal - discount;

  // Apply minimum charge if applicable
  if (pricing.minimumCharge && total < pricing.minimumCharge) {
    total = pricing.minimumCharge;
  }

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}
