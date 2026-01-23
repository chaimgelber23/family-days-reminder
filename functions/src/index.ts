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
const WHATSAPP_FROM = 'whatsapp:+14155238886'; // Sandbox
const SMS_FROM = process.env.TWILIO_PHONE_NUMBER || '+15551234567';

// Resend Config for Email
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

// Helper: Send WhatsApp message
async function sendWhatsApp(to: string, message: string) {
    return await client.messages.create({
        from: WHATSAPP_FROM,
        to: `whatsapp:${to}`,
        body: message
    });
}

// Helper: Send SMS message
async function sendSMS(to: string, message: string) {
    return await client.messages.create({
        from: SMS_FROM,
        to: to,
        body: message
    });
}

// Helper: Send Email via Resend
async function sendEmail(to: string, message: string, subject: string = '🔔 Family Days Reminder') {
    if (!RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: FROM_EMAIL,
            to: [to],
            subject: subject,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">Family Days Reminder</h2>
                    <p style="font-size: 16px; line-height: 1.6;">${message}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #666;">
                        You're receiving this because you enabled email reminders in Family Days Reminder.
                    </p>
                </div>
            `,
            text: message,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send email');
    }

    return await response.json();
}

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
        const eventDate = event.gregorianDate.toDate();
        const thisYearEvent = new Date(today.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        const diffTime = thisYearEvent.getTime() - today.getTime();
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
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

// Helper: Send notification via user's preferred methods
async function sendNotifications(
    userData: any,
    message: string,
    eventId: string,
    userId: string,
    daysUntil: number,
    timeOfDay: string,
    today: Date
) {
    // Default to whatsapp if no preferences set (backwards compatibility)
    const methods: string[] = userData.preferences?.notificationMethods || ['whatsapp'];
    const results: { method: string; success: boolean; error?: string }[] = [];

    for (const method of methods) {
        const logKey = `${eventId}_${daysUntil}_${timeOfDay}_${method}_${today.toISOString().split('T')[0]}`;

        // Check if already sent via this method
        const existingLog = await db.collection('notificationLogs').doc(logKey).get();
        if (existingLog.exists) {
            continue;
        }

        try {
            switch (method) {
                case 'email':
                    if (userData.email) {
                        await sendEmail(userData.email, message);
                        results.push({ method: 'email', success: true });
                    }
                    break;
                case 'sms':
                    if (userData.phone) {
                        await sendSMS(userData.phone, message);
                        results.push({ method: 'sms', success: true });
                    }
                    break;
                case 'whatsapp':
                    if (userData.phone) {
                        await sendWhatsApp(userData.phone, message);
                        results.push({ method: 'whatsapp', success: true });
                    }
                    break;
            }

            // Log successful send
            await db.collection('notificationLogs').doc(logKey).set({
                userId,
                eventId,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                method,
                status: 'sent',
                messageContent: message,
                timeOfDay,
                daysUntil
            });

            console.log(`Sent ${method} reminder to user ${userId} for event ${eventId}`);
        } catch (err) {
            console.error(`Failed to send ${method} to user ${userId}:`, err);
            results.push({ method, success: false, error: String(err) });

            // Log failure
            await db.collection('notificationLogs').doc(logKey).set({
                userId,
                eventId,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                method,
                status: 'failed',
                error: String(err),
                messageContent: message
            });
        }
    }

    return results;
}

/**
 * MORNING CHECK - Runs at 9 AM EST daily
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
async function processReminders(timeOfDay: string, fallbackDaysToCheck: number[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventsSnapshot = await db.collection('events').get();
    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    for (const event of events) {
        if (!event.userId) continue;

        const daysUntil = getDaysUntilEvent(event, today);

        // Determine which days should trigger a reminder for this event
        let daysToCheck = fallbackDaysToCheck;

        if (event.reminderConfig?.isEnabled && event.reminderConfig?.reminders?.length > 0) {
            const matchingReminders = event.reminderConfig.reminders.filter(
                (r: any) => r.timeOfDay === timeOfDay
            );
            daysToCheck = matchingReminders.map((r: any) => r.daysBefore);
        }

        if (!daysToCheck.includes(daysUntil)) continue;

        // Get user data
        const userDoc = await db.collection('users').doc(event.userId).get();
        const userData = userDoc.data();

        if (!userData) continue;

        const message = generateMessage(event, daysUntil, timeOfDay);
        await sendNotifications(userData, message, event.id, event.userId, daysUntil, timeOfDay, today);
    }
}

/**
 * HTTP endpoint for manual testing
 */
export const testReminder = functions.https.onRequest(async (req, res) => {
    const { phone, email, message, method = 'whatsapp' } = req.query;

    if (!message) {
        res.status(400).send('Missing message parameter');
        return;
    }

    try {
        let result;
        switch (method) {
            case 'email':
                if (!email) {
                    res.status(400).send('Missing email parameter');
                    return;
                }
                result = await sendEmail(String(email), String(message));
                break;
            case 'sms':
                if (!phone) {
                    res.status(400).send('Missing phone parameter');
                    return;
                }
                result = await sendSMS(String(phone), String(message));
                break;
            case 'whatsapp':
            default:
                if (!phone) {
                    res.status(400).send('Missing phone parameter');
                    return;
                }
                result = await sendWhatsApp(String(phone), String(message));
                break;
        }
        res.json({ success: true, method, result: result?.sid || result?.id || 'sent' });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
