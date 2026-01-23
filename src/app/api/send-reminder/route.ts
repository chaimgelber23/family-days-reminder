import { NextResponse } from 'next/server';
import twilio from 'twilio';

// Lazy initialization to avoid build-time errors
let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
    if (!twilioClient) {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        if (!accountSid || !authToken) {
            throw new Error('Twilio credentials not configured');
        }
        twilioClient = twilio(accountSid, authToken);
    }
    return twilioClient;
}

// Send via WhatsApp
async function sendWhatsApp(to: string, message: string) {
    const client = getTwilioClient();
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    const messageOptions: any = {
        to: `whatsapp:${to}`,
        body: message,
    };

    if (messagingServiceSid) {
        messageOptions.messagingServiceSid = messagingServiceSid;
    } else {
        messageOptions.from = 'whatsapp:+14155238886'; // Sandbox
    }

    return await client.messages.create(messageOptions);
}

// Send via SMS
async function sendSMS(to: string, message: string) {
    const client = getTwilioClient();
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    const messageOptions: any = {
        to: to,
        body: message,
    };

    if (messagingServiceSid) {
        messageOptions.messagingServiceSid = messagingServiceSid;
    } else if (twilioPhoneNumber) {
        messageOptions.from = twilioPhoneNumber;
    } else {
        throw new Error('No Twilio phone number configured for SMS');
    }

    return await client.messages.create(messageOptions);
}

// Send via Email using Resend
async function sendEmail(to: string, message: string, subject?: string) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'Family Days Reminder <onboarding@resend.dev>';

    if (!resendApiKey) {
        throw new Error('Email not configured. Set RESEND_API_KEY in environment.');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: fromEmail,
            to: [to],
            subject: subject || '🔔 Family Days Reminder',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Family Days Reminder</h2>
                    <p style="font-size: 16px; line-height: 1.5;">${message}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #666;">
                        You're receiving this because you signed up for Family Days Reminder.
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

export async function POST(request: Request) {
    try {
        const { to, message, method = 'whatsapp', subject } = await request.json();

        if (!to || !message) {
            return NextResponse.json(
                { error: 'Missing required fields: to, message' },
                { status: 400 }
            );
        }

        let result;

        switch (method) {
            case 'email':
                result = await sendEmail(to, message, subject);
                break;
            case 'sms':
                result = await sendSMS(to, message);
                break;
            case 'whatsapp':
            default:
                result = await sendWhatsApp(to, message);
                break;
        }

        return NextResponse.json({
            success: true,
            method,
            result: result?.sid || result?.id || 'sent'
        });

    } catch (error: any) {
        console.error(`Send reminder error:`, error);
        return NextResponse.json(
            { error: error.message || 'Failed to send message' },
            { status: 500 }
        );
    }
}
