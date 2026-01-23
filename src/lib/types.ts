import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'user';

export type NotificationMethod = 'sms' | 'whatsapp' | 'email';

export interface AppUser {
  id: string;
  email: string;
  name?: string;
  photoURL?: string;
  phone?: string; // For SMS/WhatsApp
  role: UserRole;
  createdAt: Timestamp;
  preferences?: {
    defaultReminderTime?: string; // "09:00"
    notificationMethods?: NotificationMethod[]; // e.g. ['email', 'whatsapp']
    calendarType?: 'gregorian' | 'hebrew' | 'both';
  };
}

export interface Person {
  id: string;
  userId: string; // The user who owns this person record
  name: string;
  relationship: 'family' | 'friend' | 'colleague' | 'other';
  email?: string;
  phone?: string;
  notes?: string;
  address?: string; // For potential future gift shipping
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HebrewDateInfo {
  day: number;
  month: number; // 1-13 (13 for Adar II, 1 for Nissan usually or Tishrei depending on system, hebcal uses 1=Nissan)
  year: number; // Hebrew year e.g. 5785
  monthName: string; // e.g., "Tishrei", "Nisan"
  isLeapYear?: boolean;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface ReminderSetting {
  daysBefore: number; // 0 = day of, 1 = day before, 3, 7, 14, 30
  timeOfDay: TimeOfDay;
}

export interface ReminderConfig {
  reminders: ReminderSetting[];
  isEnabled: boolean;
}

export interface FamilyEvent {
  id: string;
  userId: string;
  personId?: string; // Optional link to Person
  title: string;
  type: 'birthday' | 'anniversary' | 'yahrzeit' | 'holiday' | 'custom';

  // Date handling
  gregorianDate: Timestamp; // The Gregorian date of the event (or next occurrence)
  useHebrewDate: boolean; // If true, the Hebrew date is the source of truth
  hebrewDate?: HebrewDateInfo; // Hebrew calendar date details
  originalYear?: number; // For birthdays/anniversaries, the year it started (Gregorian)
  originalHebrewYear?: number; // For birthdays/anniversaries, the year it started (Hebrew)

  isRecurring: boolean;
  notes?: string;

  // Notification configuration
  reminderConfig?: ReminderConfig;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Reminder {
  id: string;
  eventId: string;
  userId: string;

  // Configuration
  daysBefore: number; // 0 = day of, 1 = day before, etc.
  timeOfDay: string; // "09:00" - when to send (24h format)
  method: 'sms' | 'whatsapp' | 'email';
  customMessage?: string; // Optional custom message template

  // Tracking
  isActive: boolean;
  lastSent?: Timestamp;
  nextScheduled?: Timestamp;

  createdAt: Timestamp;
}

// Notification log for history
export interface NotificationLog {
  id: string;
  userId: string;
  reminderId: string;
  eventId: string;
  sentAt: Timestamp;
  method: 'sms' | 'whatsapp' | 'email';
  status: 'sent' | 'failed' | 'delivered';
  error?: string;
  messageContent: string;
}
