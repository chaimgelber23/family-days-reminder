// @ts-nocheck
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
const twilio = require('twilio');
import { HDate } from '@hebcal/core';

admin.initializeApp();
const db = admin.firestore();

// Twilio Config
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const FROM_NUMBER = 'whatsapp:+14155238886'; // Sandbox

// Helper: Calculate days until event
function getDaysUntilEvent(event: any, today: Date): number {
    const todayHebrew = new HDate(today);

    if (event.useHebrewDate && event.hebrewDate) {
        const currentYearHebrew = todayHebrew.getFullYear();
        const eventHDate = new HDate(
            event.hebrewDate.day,
            event.hebrewDate.month,
            currentYearHebrew
        );
        const gregEventDate = eventHDate.greg();
        const diffTime = gregEventDate.getTime() - today.getTime();
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    } else {
        // Gregorian (recurring - same month/day each year)
        const eventDate = event.gregorianDate.toDate();
        const thisYearEvent = new Date(today.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        const diffTime = thisYearEvent.getTime() - today.getTime();
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
}

// Helper: Get time of day label
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
}

// Helper: Generate message based on timing
function generateMessage(event: any, daysUntil: number, timeOfDay: string): string {
    const eventName = event.title;

    if (daysUntil === 3) {
        return `📅 Heads up! ${eventName} is in 3 days. Start planning!`;
    } else if (daysUntil === 1) {
        return `⏰ Reminder: ${eventName} is TOMORROW! Don't forget!`;
    } else if (daysUntil === 0) {
        if (timeOfDay === 'morning') {
            return `🎉 Good morning! Today is ${eventName}! Have a wonderful day!`;
        } else if (timeOfDay === 'afternoon') {
            return `☀️ Afternoon reminder: It's ${eventName} today! Hope it's going great!`;
        } else {
            return `🌙 Evening check-in: ${eventName} is today! Hope you celebrated well!`;
        }
    }
    return `Reminder: ${eventName} is coming up in ${daysUntil} days.`;
}

/**
 * MORNING CHECK - Runs at 9 AM EST daily
 * Sends: 3-day reminders, 1-day reminders, morning of reminders
 */
export const morningReminders = functions.pubsub
    .schedule('0 9 * * *')
    .timeZone('America/New_York')
    .onRun(async (context) => {
        await processReminders('morning', [3, 1, 0]);
        return null;
    });

/**
 * AFTERNOON CHECK - Runs at 2 PM EST daily
 * Sends: Day-of afternoon reminder only
 */
export const afternoonReminders = functions.pubsub
    .schedule('0 14 * * *')
    .timeZone('America/New_York')
    .onRun(async (context) => {
        await processReminders('afternoon', [0]);
        return null;
    });

/**
 * EVENING CHECK - Runs at 7 PM EST daily
 * Sends: Day-of evening reminder only
 */
export const eveningReminders = functions.pubsub
    .schedule('0 19 * * *')
    .timeZone('America/New_York')
    .onRun(async (context) => {
        await processReminders('evening', [0]);
        return null;
    });

/**
 * Core logic to process and send reminders
 */
async function processReminders(timeOfDay: string, daysToCheck: number[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    const eventsSnapshot = await db.collection('events').get();
    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    const remindersToSend: { to: string; body: string; userId: string; eventId: string; daysUntil: number }[] = [];

    for (const event of events) {
        if (!event.userId) continue;

        const daysUntil = getDaysUntilEvent(event, today);

        // Check if this event matches any of the days we're checking
        if (!daysToCheck.includes(daysUntil)) continue;

        // Get user phone
        const userDoc = await db.collection('users').doc(event.userId).get();
        const userData = userDoc.data();

        if (userData?.phone) {
            // Check if we already sent this specific reminder today (prevent duplicates)
            const logKey = `${event.id}_${daysUntil}_${timeOfDay}_${today.toISOString().split('T')[0]}`;
            const existingLog = await db.collection('notificationLogs').doc(logKey).get();

            if (!existingLog.exists) {
                const message = generateMessage(event, daysUntil, timeOfDay);
                remindersToSend.push({
                    to: userData.phone,
                    body: message,
                    userId: event.userId,
                    eventId: event.id,
                    daysUntil
                });
            }
        }
    }

    // Send Messages
    for (const reminder of remindersToSend) {
        try {
            await client.messages.create({
                from: FROM_NUMBER,
                to: `whatsapp:${reminder.to}`,
                body: reminder.body
            });

            // Log successful send
            const logKey = `${reminder.eventId}_${reminder.daysUntil}_${timeOfDay}_${today.toISOString().split('T')[0]}`;
            await db.collection('notificationLogs').doc(logKey).set({
                userId: reminder.userId,
                eventId: reminder.eventId,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                method: 'whatsapp',
                status: 'sent',
                messageContent: reminder.body,
                timeOfDay: timeOfDay,
                daysUntil: reminder.daysUntil
            });

            console.log(`Sent ${timeOfDay} reminder to ${reminder.to} for event ${reminder.eventId}`);
        } catch (err) {
            console.error(`Failed to send to ${reminder.to}`, err);

            // Log failure
            const logKey = `${reminder.eventId}_${reminder.daysUntil}_${timeOfDay}_${today.toISOString().split('T')[0]}`;
            await db.collection('notificationLogs').doc(logKey).set({
                userId: reminder.userId,
                eventId: reminder.eventId,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                method: 'whatsapp',
                status: 'failed',
                error: String(err),
                messageContent: reminder.body
            });
        }
    }
}

/**
 * HTTP endpoint for manual testing
 */
export const testReminder = functions.https.onRequest(async (req, res) => {
    const { phone, message } = req.query;

    if (!phone || !message) {
        res.status(400).send('Missing phone or message parameter');
        return;
    }

    try {
        const result = await client.messages.create({
            from: FROM_NUMBER,
            to: `whatsapp:${phone}`,
            body: String(message)
        });
        res.json({ success: true, sid: result.sid });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
