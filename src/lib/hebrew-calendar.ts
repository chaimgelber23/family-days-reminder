import { HDate, HebrewCalendar, Location, Event } from '@hebcal/core';
import { HebrewDateInfo, FamilyEvent } from './types';
import { Timestamp } from 'firebase/firestore';

// Mapping of month names to numbers (Hebcal uses 1=Nisan, 7=Tishrei)
// But for UI we might want a simpler 1-12/13 system or just stick to Hebcal's
const MONTH_NAMES = [
    'Nisan', 'Iyyar', 'Sivan', 'Tamuz', 'Av', 'Elul',
    'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar I', 'Adar II'
];

/**
 * Converts a Javascript Date to Hebrew Date Info
 */
export function toHebrewDate(date: Date): HebrewDateInfo {
    const hd = new HDate(date);
    return {
        day: hd.getDate(),
        month: hd.getMonth(),
        year: hd.getFullYear(),
        monthName: hd.getMonthName(),
        isLeapYear: HDate.isLeapYear(hd.getFullYear())
    };
}

/**
 * Converts Hebrew Date Info to Javascript Date
 * Note: Hebrew days start at sundown, this returns start of day (midnight)
 */
export function toGregorianDate(hebrewDate: HebrewDateInfo): Date {
    const hd = new HDate(hebrewDate.day, hebrewDate.month, hebrewDate.year);
    return hd.greg();
}

/**
 * Formats a Hebrew date as a string
 * e.g. "15 Shevat 5785"
 */
export function formatHebrewDate(date: HebrewDateInfo): string {
    const hd = new HDate(date.day, date.month, date.year);
    return hd.render(); // or custom format
}

/**
 * Get Jewish holidays for a given gregorian year
 */
export function getJewishHolidays(year: number): Array<{ title: string, date: Date, hebrewDate: HebrewDateInfo }> {
    const events = HebrewCalendar.calendar({
        year: year,
        isHebrewYear: false,
        il: false, // Diaspora by default, maybe make configurable
        sedrot: false,
        candlelighting: false,
        havdalah: false,
        omer: false,
    });

    return events.map(ev => {
        const date = ev.getDate().greg();
        const hd = ev.getDate();
        return {
            title: ev.render(),
            date: date,
            hebrewDate: {
                day: hd.getDate(),
                month: hd.getMonth(),
                year: hd.getFullYear(),
                monthName: hd.getMonthName()
            }
        };
    });
}

/**
 * Calculate the next occurrence of a Hebrew birthday/anniversary
 */
export function getNextHebrewOccurrence(
    day: number,
    month: number, // Hebcal month enum
    originalHebrewYear?: number
): Date {
    const now = new HDate();
    const currentHebrewYear = now.getFullYear();

    // Try for this year
    let nextHd = new HDate(day, month, currentHebrewYear);

    // Handling Adar in leap years
    // If born in Adar (ordinary) and current year is leap:
    // - Birthday usually celebrated in Adar II (some say I, generally II)
    // If born in Adar I/II calculate accordingly

    // Check if date passed already
    if (nextHd.before(now.prev())) { // Check if passed (allow today)
        nextHd = new HDate(day, month, currentHebrewYear + 1);
    }

    return nextHd.greg();
}

/**
 * Helper: Get current Hebrew date
 */
export function getCurrentHebrewDate(): HebrewDateInfo {
    return toHebrewDate(new Date());
}
