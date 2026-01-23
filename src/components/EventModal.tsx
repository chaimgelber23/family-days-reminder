'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toHebrewDate } from '@/lib/hebrew-calendar';
import { FamilyEvent, TimeOfDay } from '@/lib/types';
import { Bell, Clock, X, Plus, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// Constants
const EVENT_TYPES = ['birthday', 'anniversary', 'yahrzeit', 'holiday', 'custom'];
const HEBREW_MONTHS = [
    'Nisan', 'Iyyar', 'Sivan', 'Tamuz', 'Av', 'Elul',
    'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar I', 'Adar II'
];

const REMINDER_OPTIONS = [
    { value: 0, label: 'Day of event' },
    { value: 1, label: '1 day before' },
    { value: 3, label: '3 days before' },
    { value: 7, label: '1 week before' },
    { value: 14, label: '2 weeks before' },
    { value: 30, label: '1 month before' },
];

const TIME_OPTIONS: { value: TimeOfDay; label: string; time: string }[] = [
    { value: 'morning', label: 'Morning', time: '9:00 AM' },
    { value: 'afternoon', label: 'Afternoon', time: '2:00 PM' },
    { value: 'evening', label: 'Evening', time: '7:00 PM' },
];

// Form Schema
const reminderSettingSchema = z.object({
    daysBefore: z.number(),
    timeOfDay: z.enum(['morning', 'afternoon', 'evening']),
});

const formSchema = z.object({
    title: z.string().min(2, { message: 'Title must be at least 2 characters.' }),
    type: z.enum(['birthday', 'anniversary', 'yahrzeit', 'holiday', 'custom']),
    useHebrewDate: z.boolean().default(false),
    gregorianDate: z.string(), // ISO date string YYYY-MM-DD
    hebrewDay: z.coerce.number().min(1).max(30).optional(),
    hebrewMonth: z.string().optional(),
    hebrewYear: z.coerce.number().optional(),
    isRecurring: z.boolean().default(true),
    notes: z.string().optional(),
    // Reminder configuration
    enableReminders: z.boolean().default(true),
    reminders: z.array(reminderSettingSchema).default([{ daysBefore: 1, timeOfDay: 'morning' }]),
});

export type EventFormData = z.infer<typeof formSchema>;

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: EventFormData, eventId?: string) => Promise<void>;
    initialDate?: Date;
    eventToEdit?: FamilyEvent | null;
}

export function EventModal({ isOpen, onClose, onSave, initialDate, eventToEdit }: EventModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            type: 'birthday',
            useHebrewDate: false,
            gregorianDate: format(new Date(), 'yyyy-MM-dd'),
            isRecurring: true,
            hebrewDay: 1,
            hebrewMonth: 'Nisan',
            hebrewYear: 5785,
            enableReminders: true,
            reminders: [{ daysBefore: 1, timeOfDay: 'morning' }],
        },
    });

    // Reset form when modal opens or initialDate/eventToEdit changes
    useEffect(() => {
        if (isOpen) {
            if (eventToEdit) {
                // Populate for edit mode
                const eventDate = eventToEdit.gregorianDate.toDate();
                const hd = eventToEdit.hebrewDate || toHebrewDate(eventDate);
                form.reset({
                    title: eventToEdit.title,
                    type: eventToEdit.type,
                    useHebrewDate: eventToEdit.useHebrewDate,
                    gregorianDate: format(eventDate, 'yyyy-MM-dd'),
                    isRecurring: eventToEdit.isRecurring,
                    hebrewDay: hd.day,
                    hebrewMonth: hd.monthName,
                    hebrewYear: hd.year,
                    enableReminders: eventToEdit.reminderConfig?.isEnabled ?? true,
                    reminders: eventToEdit.reminderConfig?.reminders && eventToEdit.reminderConfig.reminders.length > 0
                        ? eventToEdit.reminderConfig.reminders
                        : [{ daysBefore: 1, timeOfDay: 'morning' }],
                });
            } else if (initialDate) {
                const hd = toHebrewDate(initialDate);
                form.reset({
                    title: '',
                    type: 'birthday',
                    useHebrewDate: false,
                    gregorianDate: format(initialDate, 'yyyy-MM-dd'),
                    isRecurring: true,
                    hebrewDay: hd.day,
                    hebrewMonth: hd.monthName,
                    hebrewYear: hd.year,
                    enableReminders: true,
                    reminders: [{ daysBefore: 1, timeOfDay: 'morning' }],
                });
            }
        }
    }, [isOpen, initialDate, eventToEdit, form]);

    const useHebrew = form.watch('useHebrewDate');

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (isSubmitting) return; // Prevent double-submission

        setIsSubmitting(true);
        try {
            await onSave(values, eventToEdit?.id);
            form.reset();
            onClose();
        } catch (error) {
            console.error('Failed to save event:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            form.reset();
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px] max-h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>{eventToEdit ? 'Edit Event' : 'Add New Event'}</DialogTitle>
                    <DialogDescription>
                        {eventToEdit
                            ? 'Update the details of your event.'
                            : 'Add a birthday, anniversary, or special day to your calendar.'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-hidden px-6">
                    <Form {...form}>
                        <form id="event-form" onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
                            <ScrollArea className="flex-1 -mx-6 px-6">
                                <div className="space-y-4 py-4 px-1">
                                    <FormField
                                        control={form.control}
                                        name="title"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Event Title</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Mom's Birthday" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Event Type</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select type" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {EVENT_TYPES.map(type => (
                                                            <SelectItem key={type} value={type} className="capitalize">
                                                                {type}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="useHebrewDate"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel>Use Hebrew Date</FormLabel>
                                                    <FormDescription>
                                                        Event repeats on the Hebrew calendar
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {!useHebrew ? (
                                        <FormField
                                            control={form.control}
                                            name="gregorianDate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Date</FormLabel>
                                                    <FormControl>
                                                        <Input type="date" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="hebrewDay"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Day</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" min={1} max={30} {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="hebrewMonth"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Month</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select month" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {HEBREW_MONTHS.map(month => (
                                                                    <SelectItem key={month} value={month}>
                                                                        {month}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    <FormField
                                        control={form.control}
                                        name="isRecurring"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel>Annual Repeat</FormLabel>
                                                    <FormDescription>
                                                        Remind me every year
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {/* Notification Configuration Section */}
                                    <div className="space-y-3 rounded-lg border p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Bell className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">Notifications</span>
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="enableReminders"
                                                render={({ field }) => (
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                )}
                                            />
                                        </div>

                                        {form.watch('enableReminders') && (
                                            <div className="space-y-3 pt-2">
                                                {form.watch('reminders').map((_, index) => (
                                                    <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                                            <Select
                                                                value={String(form.watch(`reminders.${index}.daysBefore`))}
                                                                onValueChange={(val) => {
                                                                    const reminders = form.getValues('reminders');
                                                                    reminders[index].daysBefore = parseInt(val);
                                                                    form.setValue('reminders', [...reminders]);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8 text-sm">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {REMINDER_OPTIONS.map(opt => (
                                                                        <SelectItem key={opt.value} value={String(opt.value)}>
                                                                            {opt.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>

                                                            <Select
                                                                value={form.watch(`reminders.${index}.timeOfDay`)}
                                                                onValueChange={(val: TimeOfDay) => {
                                                                    const reminders = form.getValues('reminders');
                                                                    reminders[index].timeOfDay = val;
                                                                    form.setValue('reminders', [...reminders]);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8 text-sm">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {TIME_OPTIONS.map(opt => (
                                                                        <SelectItem key={opt.value} value={opt.value}>
                                                                            <div className="flex items-center gap-1">
                                                                                <Clock className="h-3 w-3" />
                                                                                {opt.label} ({opt.time})
                                                                            </div>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                            onClick={() => {
                                                                const reminders = form.getValues('reminders');
                                                                reminders.splice(index, 1);
                                                                form.setValue('reminders', [...reminders]);
                                                            }}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={() => {
                                                        const reminders = form.getValues('reminders');
                                                        form.setValue('reminders', [
                                                            ...reminders,
                                                            { daysBefore: 1, timeOfDay: 'morning' }
                                                        ]);
                                                    }}
                                                >
                                                    <Plus className="h-4 w-4 mr-1" />
                                                    Add Another Reminder
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </ScrollArea>
                        </form>
                    </Form>
                </div>

                <DialogFooter className="p-6 pt-2 border-t mt-auto bg-background z-20">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    {/* Trigger form submission using form ID */}
                    <Button type="submit" form="event-form" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {eventToEdit ? 'Update Event' : 'Save Event'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
