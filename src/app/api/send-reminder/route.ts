import { NextResponse } from 'next/server';
import twilio from 'twilio';

// Initialize Twilio client
// In production, use environment variables!
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

const client = twilio(accountSid, authToken);

export async function POST(request: Request) {
    try {
        const { to, message, scheduledTime } = await request.json();

        if (!to || !message) {
            return NextResponse.json(
                { error: 'Missing required fields: to, message' },
                { status: 400 }
            );
        }

        if (!accountSid || !authToken) {
            console.error('Twilio credentials missing');
            return NextResponse.json(
                { error: 'Server configuration error: Twilio credentials missing' },
                { status: 500 }
            );
        }

        const messageOptions: any = {
            to: `whatsapp:${to}`,
            body: message,
        };

        if (messagingServiceSid) {
            messageOptions.messagingServiceSid = messagingServiceSid;
        } else {
            // Fallback to Sandbox Number
            messageOptions.from = 'whatsapp:+14155238886';
        }

        // If scheduledTime is provided, use Twilio's scheduling
        if (scheduledTime) {
            messageOptions.sendAt = new Date(scheduledTime);
            messageOptions.scheduleType = 'fixed';
        }

        const result = await client.messages.create(messageOptions);

        return NextResponse.json({
            success: true,
            sid: result.sid,
            status: result.status
        });

    } catch (error: any) {
        console.error('Twilio Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to send message' },
            { status: 500 }
        );
    }
}
