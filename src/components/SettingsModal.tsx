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
import { Checkbox } from '@/components/ui/checkbox';
import { useFirestore, useUser } from '@/firebase/provider';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';
import { useRouter } from 'next/navigation';
import { Mail, MessageSquare, Phone, Loader2 } from 'lucide-react';
import { NotificationMethod } from '@/lib/types';

const formSchema = z.object({
    name: z.string().min(2, 'Name is required'),
    phone: z.string().optional(),
    notifyEmail: z.boolean().default(true),
    notifySms: z.boolean().default(false),
    notifyWhatsapp: z.boolean().default(false),
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
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            phone: '',
            notifyEmail: true,
            notifySms: false,
            notifyWhatsapp: false,
            defaultReminderDays: 1,
        },
    });

    // Watch notification method values
    const notifyEmail = form.watch('notifyEmail');
    const notifySms = form.watch('notifySms');
    const notifyWhatsapp = form.watch('notifyWhatsapp');
    const needsPhone = notifySms || notifyWhatsapp;

    // Load existing user settings when modal opens
    useEffect(() => {
        if (isOpen && user) {
            const loadUserSettings = async () => {
                try {
                    const userDoc = await getDoc(doc(firestore, 'users', user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        const methods: NotificationMethod[] = data.preferences?.notificationMethods || ['email'];
                        form.reset({
                            name: data.name || '',
                            phone: data.phone || '',
                            notifyEmail: methods.includes('email'),
                            notifySms: methods.includes('sms'),
                            notifyWhatsapp: methods.includes('whatsapp'),
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
        // Validate: at least one notification method must be selected
        if (!values.notifyEmail && !values.notifySms && !values.notifyWhatsapp) {
            form.setError('notifyEmail', { message: 'Select at least one notification method' });
            return;
        }

        // Validate: phone required if SMS or WhatsApp selected
        if ((values.notifySms || values.notifyWhatsapp) && !values.phone) {
            form.setError('phone', { message: 'Phone number required for SMS/WhatsApp' });
            return;
        }

        setIsSaving(true);
        try {
            // Build notification methods array
            const notificationMethods: NotificationMethod[] = [];
            if (values.notifyEmail) notificationMethods.push('email');
            if (values.notifySms) notificationMethods.push('sms');
            if (values.notifyWhatsapp) notificationMethods.push('whatsapp');

            // Save to Firestore
            await setDoc(doc(firestore, 'users', userId), {
                name: values.name,
                phone: values.phone || null,
                email: user?.email,
                preferences: {
                    notificationMethods,
                    defaultReminderDays: values.defaultReminderDays,
                },
                updatedAt: new Date(),
            }, { merge: true });

            onClose();
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const [isSendingTest, setIsSendingTest] = useState(false);

    const handleTestMessage = async (method: 'whatsapp' | 'sms' | 'email') => {
        const phone = form.getValues('phone');

        if ((method === 'whatsapp' || method === 'sms') && !phone) {
            return alert("Please enter a phone number first");
        }

        setIsSendingTest(true);
        try {
            const res = await fetch('/api/send-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: method === 'email' ? user?.email : phone,
                    message: "🔔 Test notification from Family Days Reminder!",
                    method,
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Test ${method} sent! Check your ${method === 'email' ? 'inbox' : method}.`);
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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Configure your profile and notification preferences.
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

                        {/* Notification Methods */}
                        <div className="space-y-3">
                            <FormLabel>How would you like to receive reminders?</FormLabel>
                            <div className="space-y-2">
                                <FormField
                                    control={form.control}
                                    name="notifyEmail"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="flex-1 flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <FormLabel className="font-normal cursor-pointer">Email</FormLabel>
                                                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                                                </div>
                                            </div>
                                            {field.value && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleTestMessage('email')}
                                                    disabled={isSendingTest}
                                                >
                                                    {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                                                </Button>
                                            )}
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="notifySms"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="flex-1 flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <FormLabel className="font-normal cursor-pointer">SMS Text Message</FormLabel>
                                                    <p className="text-xs text-muted-foreground">Standard text message</p>
                                                </div>
                                            </div>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="notifyWhatsapp"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="flex-1 flex items-center gap-2">
                                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <FormLabel className="font-normal cursor-pointer">WhatsApp</FormLabel>
                                                    <p className="text-xs text-muted-foreground">Via WhatsApp messaging</p>
                                                </div>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormMessage>{form.formState.errors.notifyEmail?.message}</FormMessage>
                        </div>

                        {/* Phone Number - only show if SMS or WhatsApp selected */}
                        {needsPhone && (
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone Number</FormLabel>
                                        <div className="flex gap-2">
                                            <FormControl>
                                                <Input placeholder="+15551234567" {...field} />
                                            </FormControl>
                                            {(notifySms || notifyWhatsapp) && field.value && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleTestMessage(notifyWhatsapp ? 'whatsapp' : 'sms')}
                                                    disabled={isSendingTest}
                                                >
                                                    {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                                                </Button>
                                            )}
                                        </div>
                                        <FormDescription>
                                            Include country code (e.g., +1 for US)
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* WhatsApp Sandbox Instructions */}
                        {notifyWhatsapp && (
                            <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
                                <p className="font-medium">📱 WhatsApp Setup (Twilio Sandbox)</p>
                                <p className="text-muted-foreground text-xs">
                                    To receive WhatsApp messages, send <code className="bg-background px-1 rounded">join &lt;sandbox-code&gt;</code> to <strong>+1 (415) 523-8886</strong> first.
                                </p>
                            </div>
                        )}

                        <FormField
                            control={form.control}
                            name="defaultReminderDays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Default Reminder Days Before</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={0} max={30} {...field} />
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
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Settings
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
