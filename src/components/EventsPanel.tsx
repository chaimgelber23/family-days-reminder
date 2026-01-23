'use client';

import React, { useState } from 'react';
import { FamilyEvent } from '@/lib/types';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
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
import { Search, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { formatHebrewDate } from '@/lib/hebrew-calendar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EventsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    events: FamilyEvent[];
    onDeleteEvent: (eventId: string) => Promise<void>;
    onEditEvent: (event: FamilyEvent) => void;
}

export function EventsPanel({ isOpen, onClose, events, onDeleteEvent, onEditEvent }: EventsPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredEvents = events
        .filter(event =>
            event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            event.type.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => a.title.localeCompare(b.title));

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
                <SheetHeader>
                    <SheetTitle>All Events</SheetTitle>
                    <SheetDescription>
                        View, edit, and manage all your family events.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex items-center gap-2 my-4">
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
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEvents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                            No events found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredEvents.map(event => (
                                        <TableRow key={event.id}>
                                            <TableCell>
                                                <div className="font-medium">{event.title}</div>
                                                <div className="text-xs text-muted-foreground capitalize">{event.type}</div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {event.useHebrewDate && event.hebrewDate
                                                    ? formatHebrewDate(event.hebrewDate)
                                                    : format(event.gregorianDate.toDate(), 'MMM d, yyyy')
                                                }
                                                {event.isRecurring && <span className="text-xs text-muted-foreground ml-1">(Annual)</span>}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        onClick={() => onEditEvent(event)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => onDeleteEvent(event.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>

                <div className="mt-4 text-sm text-muted-foreground text-center">
                    {events.length} event{events.length !== 1 ? 's' : ''} total
                </div>
            </SheetContent>
        </Sheet>
    );
}
