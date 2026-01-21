'use client';

import React, { useEffect } from 'react';
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
import { doc, setDoc } from 'firebase/firestore';

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
    const userId = user?.uid || 'anonymous';

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            phone: '',
            defaultReminderDays: 1,
        },
    });

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

    const [isSendingTest, setIsSendingTest] = React.useState(false);

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
                                        Used for reminders. Must include country code.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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

                        <DialogFooter>
                            <Button type="submit">Save Settings</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
