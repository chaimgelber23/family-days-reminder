'use client';

import React, { useState } from 'react';
import { FamilyEvent } from '@/lib/types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatHebrewDate } from '@/lib/hebrew-calendar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ManageEventsModalProps {
    isOpen: boolean;
    onClose: () => void;
    events: FamilyEvent[];
    onDeleteEvent: (eventId: string) => Promise<void>;
}

export function ManageEventsModal({ isOpen, onClose, events, onDeleteEvent }: ManageEventsModalProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredEvents = events.filter(event =>
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Events</DialogTitle>
                    <DialogDescription>
                        View and manage all your family events.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2 mb-4">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1"
                    />
                </div>

                <div className="flex-1 overflow-hidden border rounded-md">
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEvents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                            No events found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredEvents.map(event => (
                                        <TableRow key={event.id}>
                                            <TableCell className="font-medium">{event.title}</TableCell>
                                            <TableCell>
                                                {event.useHebrewDate && event.hebrewDate
                                                    ? formatHebrewDate(event.hebrewDate)
                                                    : format(event.gregorianDate.toDate(), 'MMM d, yyyy')
                                                }
                                                {event.isRecurring && <span className="text-xs text-muted-foreground ml-1">(Annual)</span>}
                                            </TableCell>
                                            <TableCell className="capitalize">{event.type}</TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                    onClick={() => onDeleteEvent(event.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
