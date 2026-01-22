'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser } from '@/firebase/provider';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
    name: z.string().min(2, 'Name is required'),
    phone: z.string().min(10, 'Valid phone number required (e.g. +1555...)'),
    defaultReminderDays: z.coerce.number().min(0).max(30),
});

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const auth = useAuth();
    const router = useRouter();
    const userId = user?.uid || 'anonymous';

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            phone: '',
            defaultReminderDays: 1,
        },
    });

    // Load existing user settings when modal opens
    useEffect(() => {
        if (isOpen && user) {
            const loadUserSettings = async () => {
                try {
                    const userDoc = await getDoc(doc(firestore, 'users', user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        form.reset({
                            name: data.name || '',
                            phone: data.phone || '',
                            defaultReminderDays: data.preferences?.defaultReminderDays || 1,
                        });
                    }
                } catch (error) {
                    console.error('Error loading user settings:', error);
                }
            };
            loadUserSettings();
        }
    }, [isOpen, user, firestore, form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            // Save to Firestore
            await setDoc(doc(firestore, 'users', userId), {
                name: values.name,
                phone: values.phone,
                preferences: {
                    defaultReminderDays: values.defaultReminderDays
                },
                updatedAt: new Date(),
            }, { merge: true });

            onClose();
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    };

    const [isSendingTest, setIsSendingTest] = useState(false);

    const handleTestMessage = async () => {
        const phone = form.getValues('phone');
        if (!phone) return alert("Please enter a phone number first");

        setIsSendingTest(true);
        try {
            const res = await fetch('/api/send-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: phone,
                    message: "🔔 Test notification from Family Days Reminder! Integrating seamlessly!"
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Test message sent! Check your WhatsApp.");
            } else {
                alert("Failed: " + (data.error || "Unknown error"));
            }
        } catch (e) {
            alert("Error sending test: " + String(e));
        } finally {
            setIsSendingTest(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>User Settings</DialogTitle>
                    <DialogDescription>
                        Configure your notifications and preferences.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Your name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>WhatsApp Number</FormLabel>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            <Input placeholder="+1..." {...field} />
                                        </FormControl>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleTestMessage}
                                            disabled={isSendingTest}
                                        >
                                            {isSendingTest ? "Sending..." : "Test"}
                                        </Button>
                                    </div>
                                    <FormDescription>
                                        Used for reminders. Must include country code (e.g., +15551234567).
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Twilio Sandbox Instructions */}
                        <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
                            <p className="font-medium">📱 WhatsApp Setup (Twilio Sandbox)</p>
                            <p className="text-muted-foreground">
                                To receive test messages, you must first connect your WhatsApp:
                            </p>
                            <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                                <li>Open WhatsApp on your phone</li>
                                <li>Send <code className="bg-background px-1 rounded">join &lt;sandbox-code&gt;</code> to <strong>+1 (415) 523-8886</strong></li>
                                <li>Wait for confirmation, then click Test above</li>
                            </ol>
                            <p className="text-xs text-muted-foreground mt-2">
                                Check your Twilio Console for your specific sandbox code.
                            </p>
                        </div>

                        <FormField
                            control={form.control}
                            name="defaultReminderDays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Default Reminder Days Before</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="flex justify-between sm:justify-between w-full">
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={async () => {
                                    try {
                                        await signOut(auth);
                                        onClose();
                                        router.push('/login');
                                    } catch (error) {
                                        console.error('Error signing out:', error);
                                    }
                                }}
                            >
                                Sign Out
                            </Button>
                            <Button type="submit">Save Settings</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
