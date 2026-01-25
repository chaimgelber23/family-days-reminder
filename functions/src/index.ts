import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { HDate } from '@hebcal/core';

// Twilio types
interface TwilioMessageInstance {
    sid: string;
    status: string;
}

interface TwilioMessagesCreate {
    create(options: { from: string; to: string; body: string }): Promise<TwilioMessageInstance>;
}

interface TwilioClient {
    messages: TwilioMessagesCreate;
}

type TwilioFactory = (accountSid: string, authToken: string) => TwilioClient;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const twilio: TwilioFactory = require('twilio');

// Event and User types for Cloud Functions
interface HebrewDateInfo {
    day: number;
    month: number;
    year: number;
    monthName: string;
}

interface ReminderSetting {
    daysBefore: number;
    timeOfDay: 'morning' | 'afternoon' | 'evening';
}

interface ReminderConfig {
    isEnabled: boolean;
    reminders: ReminderSetting[];
}

interface FamilyEventData {
    id: string;
    userId: string;
    title: string;
    type: 'birthday' | 'anniversary' | 'yahrzeit' | 'holiday' | 'custom';
    gregorianDate: admin.firestore.Timestamp;
    useHebrewDate: boolean;
    hebrewDate?: HebrewDateInfo;
    isRecurring: boolean;
    reminderConfig?: ReminderConfig;
}

interface UserData {
    id: string;
    email?: string;
    phone?: string;
    preferences?: {
        notificationMethods?: ('email' | 'sms' | 'whatsapp')[];
    };
}

interface NotificationResult {
    method: string;
    success: boolean;
    error?: string;
}

admin.initializeApp();
const db = admin.firestore();

// Secrets configuration for functions
const runtimeOpts: functions.RuntimeOptions = {
    secrets: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'TWILIO_WHATSAPP_NUMBER', 'RESEND_API_KEY', 'FROM_EMAIL'],
};

function getTwilioClient(): TwilioClient {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured');
    }
    return twilio(accountSid, authToken);
}

function getSmsFrom(): string {
    const phone = process.env.TWILIO_PHONE_NUMBER;
    if (!phone) {
        throw new Error('TWILIO_PHONE_NUMBER not configured');
    }
    return phone;
}

function getWhatsAppFrom(): string {
    // Use configured WhatsApp number, or fallback to SMS number with whatsapp: prefix
    const whatsappNum = process.env.TWILIO_WHATSAPP_NUMBER;
    if (whatsappNum) {
        return whatsappNum.startsWith('whatsapp:') ? whatsappNum : `whatsapp:${whatsappNum}`;
    }
    // Fallback to Twilio sandbox for development (remove in production)
    console.warn('TWILIO_WHATSAPP_NUMBER not configured, using Twilio sandbox');
    return 'whatsapp:+14155238886';
}

function getResendApiKey(): string | undefined {
    return process.env.RESEND_API_KEY;
}

function getFromEmail(): string {
    return process.env.FROM_EMAIL || 'Family Days Reminder <noreply@familydaysreminder.com>';
}

// Helper: Send WhatsApp message
async function sendWhatsApp(to: string, message: string): Promise<TwilioMessageInstance> {
    const client = getTwilioClient();
    return await client.messages.create({
        from: getWhatsAppFrom(),
        to: `whatsapp:${to}`,
        body: message
    });
}

// Helper: Send SMS message
async function sendSMS(to: string, message: string): Promise<TwilioMessageInstance> {
    const client = getTwilioClient();
    return await client.messages.create({
        from: getSmsFrom(),
        to: to,
        body: message
    });
}

// Email response type
interface ResendEmailResponse {
    id: string;
}

// Helper: Send Email via Resend
async function sendEmail(to: string, message: string, subject: string = '🔔 Family Days Reminder'): Promise<ResendEmailResponse> {
    const apiKey = getResendApiKey();
    if (!apiKey) {
        throw new Error('RESEND_API_KEY not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: getFromEmail(),
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
        const errorData = await response.json() as { message?: string };
        throw new Error(errorData.message || 'Failed to send email');
    }

    return await response.json() as ResendEmailResponse;
}

// Helper: Calculate days until event
function getDaysUntilEvent(event: FamilyEventData, today: Date): number {
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
function generateMessage(event: FamilyEventData, daysUntil: number, timeOfDay: string): string {
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
    userData: UserData,
    message: string,
    eventId: string,
    userId: string,
    daysUntil: number,
    timeOfDay: string,
    today: Date
): Promise<NotificationResult[]> {
    // Default to whatsapp if no preferences set (backwards compatibility)
    const methods = userData.preferences?.notificationMethods || ['whatsapp'];
    const results: NotificationResult[] = [];

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
export const morningReminders = functions
    .runWith(runtimeOpts)
    .pubsub
    .schedule('0 9 * * *')
    .timeZone('America/New_York')
    .onRun(async (context) => {
        await processReminders('morning', [3, 1, 0]);
        return null;
    });

/**
 * AFTERNOON CHECK - Runs at 2 PM EST daily
 */
export const afternoonReminders = functions
    .runWith(runtimeOpts)
    .pubsub
    .schedule('0 14 * * *')
    .timeZone('America/New_York')
    .onRun(async (context) => {
        await processReminders('afternoon', [0]);
        return null;
    });

/**
 * EVENING CHECK - Runs at 7 PM EST daily
 */
export const eveningReminders = functions
    .runWith(runtimeOpts)
    .pubsub
    .schedule('0 19 * * *')
    .timeZone('America/New_York')
    .onRun(async (context) => {
        await processReminders('evening', [0]);
        return null;
    });

/**
 * Core logic to process and send reminders
 */
async function processReminders(timeOfDay: string, fallbackDaysToCheck: number[]): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventsSnapshot = await db.collection('events').get();
    const events = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as FamilyEventData));

    for (const event of events) {
        if (!event.userId) continue;

        const daysUntil = getDaysUntilEvent(event, today);

        // Determine which days should trigger a reminder for this event
        let daysToCheck = fallbackDaysToCheck;

        if (event.reminderConfig?.isEnabled && event.reminderConfig?.reminders?.length > 0) {
            const matchingReminders = event.reminderConfig.reminders.filter(
                (r) => r.timeOfDay === timeOfDay
            );
            daysToCheck = matchingReminders.map((r) => r.daysBefore);
        }

        if (!daysToCheck.includes(daysUntil)) continue;

        // Get user data
        const userDoc = await db.collection('users').doc(event.userId).get();
        const userData = userDoc.data() as UserData | undefined;

        if (!userData) continue;

        const message = generateMessage(event, daysUntil, timeOfDay);
        await sendNotifications(userData, message, event.id, event.userId, daysUntil, timeOfDay, today);
    }
}

/**
 * HTTP endpoint for manual testing
 */
export const testReminder = functions
    .runWith(runtimeOpts)
    .https.onRequest(async (req, res) => {
    const { phone, email, message, method = 'whatsapp' } = req.query;

    if (!message) {
        res.status(400).send('Missing message parameter');
        return;
    }

    try {
        let resultId: string = 'sent';
        switch (method) {
            case 'email':
                if (!email) {
                    res.status(400).send('Missing email parameter');
                    return;
                }
                const emailResult = await sendEmail(String(email), String(message));
                resultId = emailResult.id;
                break;
            case 'sms':
                if (!phone) {
                    res.status(400).send('Missing phone parameter');
                    return;
                }
                const smsResult = await sendSMS(String(phone), String(message));
                resultId = smsResult.sid;
                break;
            case 'whatsapp':
            default:
                if (!phone) {
                    res.status(400).send('Missing phone parameter');
                    return;
                }
                const whatsappResult = await sendWhatsApp(String(phone), String(message));
                resultId = whatsappResult.sid;
                break;
        }
        res.json({ success: true, method, result: resultId });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
