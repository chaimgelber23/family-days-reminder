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
import { FamilyEvent } from '@/lib/types';

// Constants
const EVENT_TYPES = ['birthday', 'anniversary', 'yahrzeit', 'holiday', 'custom'];
const HEBREW_MONTHS = [
    'Nisan', 'Iyyar', 'Sivan', 'Tamuz', 'Av', 'Elul',
    'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar I', 'Adar II'
];

// Form Schema
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
});

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialDate?: Date;
    eventToEdit?: FamilyEvent;
}

export function EventModal({ isOpen, onClose, onSave, initialDate, eventToEdit }: EventModalProps) {
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
        },
    });

    // Reset form when modal opens or initialDate changes
    useEffect(() => {
        if (isOpen) {
            if (eventToEdit) {
                // TODO: Populate for edit mode
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
                    hebrewYear: hd.year
                });
            }
        }
    }, [isOpen, initialDate, eventToEdit, form]);

    const useHebrew = form.watch('useHebrewDate');

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            await onSave(values);
            onClose();
            form.reset();
        } catch (error) {
            console.error('Failed to save event:', error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{eventToEdit ? 'Edit Event' : 'Add New Event'}</DialogTitle>
                    <DialogDescription>
                        Add a birthday, anniversary, or special day to your calendar.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

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
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit">Save Event</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
