'use client';

import { useState, useEffect, useMemo } from 'react';
import { EventCalendar } from '@/components/EventCalendar';
import { EventModal, EventFormData } from '@/components/EventModal';
import { FamilyEvent } from '@/lib/types';
import { Timestamp, collection, doc, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { SettingsModal } from '@/components/SettingsModal';
import { Settings, Trash2, Calendar, Bell, Pencil } from 'lucide-react';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser } from '@/firebase/provider';
import { toHebrewDate, formatHebrewDate, getHebrewMonthNumber, toGregorianDate } from '@/lib/hebrew-calendar';
import { format, differenceInDays, isBefore, startOfDay } from 'date-fns';

type CalendarFilter = 'all' | 'english' | 'hebrew';
type TypeFilter = 'all' | 'birthday' | 'anniversary';

export default function DashboardPage() {
    const [events, setEvents] = useState<FamilyEvent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [eventToEdit, setEventToEdit] = useState<FamilyEvent | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Filter states
    const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>('all');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const router = useRouter();

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isUserLoading && !user) {
            const t = setTimeout(() => {
                router.push('/login');
            }, 100);
            return () => clearTimeout(t);
        }
    }, [user, isUserLoading, router]);

    // Load events from Firestore when user is authenticated
    useEffect(() => {
        if (isUserLoading || !user) {
            if (!isUserLoading && !user) {
                setEvents([]);
                setIsLoading(false);
            }
            return;
        }

        const eventsRef = collection(firestore, 'events');
        const q = query(eventsRef, where('userId', '==', user.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedEvents: FamilyEvent[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as FamilyEvent));
            setEvents(loadedEvents);
            setIsLoading(false);
        }, (error) => {
            console.error('Error loading events:', error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, user, isUserLoading]);

    const handleAddEvent = (date: Date) => {
        setEventToEdit(null);
        setSelectedDate(date);
        setIsModalOpen(true);
    };

    const handleEditEvent = (event: FamilyEvent) => {
        setEventToEdit(event);
        setSelectedDate(event.gregorianDate.toDate());
        setIsModalOpen(true);
    };

    const handleSaveEvent = async (data: EventFormData, existingEventId?: string) => {
        console.log('handleSaveEvent called', { data, existingEventId });

        if (!user) {
            alert('Please sign in to save events');
            return;
        }

        let gregorianDate: Date;
        let hebrewDate;

        try {
            if (data.useHebrewDate && data.hebrewDay && data.hebrewMonth && data.hebrewYear) {
                // When using Hebrew date, calculate gregorian from Hebrew
                hebrewDate = {
                    day: data.hebrewDay,
                    monthName: data.hebrewMonth,
                    year: data.hebrewYear,
                    month: getHebrewMonthNumber(data.hebrewMonth)
                };
                // Convert Hebrew date to Gregorian
                console.log('Converting Hebrew to Gregorian:', hebrewDate);
                gregorianDate = toGregorianDate(hebrewDate);
                console.log('Gregorian result:', gregorianDate);
            } else {
                // Parse date string (YYYY-MM-DD) as local noon to avoid timezone shifts
                const [year, month, day] = data.gregorianDate.split('-').map(Number);
                gregorianDate = new Date(year, month - 1, day, 12, 0, 0);
                hebrewDate = toHebrewDate(gregorianDate);
            }
        } catch (err) {
            console.error('Error in date conversion:', err);
            alert('Error converting date: ' + (err instanceof Error ? err.message : String(err)));
            throw err;
        }

        if (!existingEventId) {
            // Check for duplicate on the SAME DAY (ignoring time)
            const duplicate = events.find(e => {
                const eDate = e.gregorianDate.toDate();
                return e.title.toLowerCase() === data.title.toLowerCase() &&
                    eDate.getDate() === gregorianDate.getDate() &&
                    eDate.getMonth() === gregorianDate.getMonth() &&
                    eDate.getFullYear() === gregorianDate.getFullYear();
            });

            if (duplicate) {
                const confirmed = confirm(
                    `An event "${duplicate.title}" already exists on this date. Do you want to add a duplicate?`
                );
                if (!confirmed) {
                    return; // Just return, don't throw error
                }
            }
        }

        const eventId = existingEventId || crypto.randomUUID();

        // Ensure reminder config is valid
        const reminderConfig = data.enableReminders ? {
            isEnabled: true,
            reminders: data.reminders.length > 0 ? data.reminders : [{ daysBefore: 1, timeOfDay: 'morning' as const }],
        } : {
            isEnabled: false,
            reminders: [],
        };

        const eventData: FamilyEvent = {
            id: eventId,
            userId: user.uid,
            title: data.title,
            type: data.type,
            gregorianDate: Timestamp.fromDate(gregorianDate),
            useHebrewDate: data.useHebrewDate,
            isRecurring: data.isRecurring,
            originalYear: gregorianDate.getFullYear(),
            createdAt: existingEventId ? (eventToEdit?.createdAt || Timestamp.now()) : Timestamp.now(),
            updatedAt: Timestamp.now(),
            reminderConfig,
        };

        if (data.useHebrewDate) {
            eventData.hebrewDate = hebrewDate;
            eventData.originalHebrewYear = hebrewDate.year;
        }

        // Start the save operation without waiting for server confirmation
        // The onSnapshot listener will update the UI when the save completes
        // This provides a better UX with long-polling connections
        console.log('Saving event to Firestore:', eventId, eventData);
        setDoc(doc(firestore, 'events', eventId), eventData)
            .then(() => console.log('Event saved successfully'))
            .catch((error) => {
                console.error('Error saving event:', error);
                alert('Failed to save event: ' + (error instanceof Error ? error.message : String(error)));
            });
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm('Are you sure you want to delete this event?')) return;

        try {
            await deleteDoc(doc(firestore, 'events', eventId));
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Failed to delete event. Please try again.');
        }
    };

    // Filter and sort all events
    const filteredEvents = useMemo(() => {
        const today = startOfDay(new Date());

        return events
            .filter(event => {
                // Calendar filter
                if (calendarFilter === 'english' && event.useHebrewDate) return false;
                if (calendarFilter === 'hebrew' && !event.useHebrewDate) return false;

                // Type filter
                if (typeFilter === 'birthday' && event.type !== 'birthday') return false;
                if (typeFilter === 'anniversary' && event.type !== 'anniversary') return false;

                return true;
            })
            .map(event => {
                const eventDate = event.gregorianDate.toDate();
                let nextOccurrence: Date;

                if (event.isRecurring) {
                    const thisYearDate = new Date(today.getFullYear(), eventDate.getMonth(), eventDate.getDate());
                    if (isBefore(thisYearDate, today)) {
                        nextOccurrence = new Date(today.getFullYear() + 1, eventDate.getMonth(), eventDate.getDate());
                    } else {
                        nextOccurrence = thisYearDate;
                    }
                } else {
                    nextOccurrence = eventDate;
                }

                const daysUntil = differenceInDays(nextOccurrence, today);
                return { event, nextDate: nextOccurrence, daysUntil };
            })
            .sort((a, b) => a.daysUntil - b.daysUntil);
    }, [events, calendarFilter, typeFilter]);

    if (isUserLoading || isLoading) {
        return <DashboardSkeleton />;
    }

    if (!user) {
        return null;
    }

    return (
        <div className="container mx-auto p-6 h-screen flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Family Days Reminder</h1>
                <Button variant="outline" size="icon" onClick={() => setIsSettingsOpen(true)}>
                    <Settings className="h-5 w-5" />
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
                {/* Main Calendar Area */}
                <div className="lg:col-span-3 h-full">
                    <EventCalendar
                        events={events}
                        onAddEvent={handleAddEvent}
                        onViewEvent={handleEditEvent}
                    />
                </div>

                {/* Sidebar - All Events with Filters */}
                <div className="bg-card border rounded-lg p-4 h-full overflow-hidden flex flex-col">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        All Events
                    </h3>

                    {/* Filter Buttons */}
                    <div className="space-y-2 mb-4">
                        {/* Calendar Type Filter */}
                        <div className="flex gap-1 flex-wrap">
                            <Button
                                variant={calendarFilter === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCalendarFilter('all')}
                                className="text-xs h-7"
                            >
                                All
                            </Button>
                            <Button
                                variant={calendarFilter === 'english' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCalendarFilter('english')}
                                className="text-xs h-7"
                            >
                                English
                            </Button>
                            <Button
                                variant={calendarFilter === 'hebrew' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCalendarFilter('hebrew')}
                                className="text-xs h-7"
                            >
                                Hebrew
                            </Button>
                        </div>

                        {/* Event Type Filter */}
                        <div className="flex gap-1 flex-wrap">
                            <Button
                                variant={typeFilter === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTypeFilter('all')}
                                className="text-xs h-7"
                            >
                                All Types
                            </Button>
                            <Button
                                variant={typeFilter === 'birthday' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTypeFilter('birthday')}
                                className="text-xs h-7"
                            >
                                Birthdays
                            </Button>
                            <Button
                                variant={typeFilter === 'anniversary' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTypeFilter('anniversary')}
                                className="text-xs h-7"
                            >
                                Anniversaries
                            </Button>
                        </div>
                    </div>

                    {/* Events List */}
                    <div className="flex-1 overflow-auto">
                        {filteredEvents.length === 0 ? (
                            <div className="text-muted-foreground text-sm text-center py-8">
                                No events found
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredEvents.map(({ event, nextDate, daysUntil }) => (
                                    <div
                                        key={event.id}
                                        className="p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{event.title}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {event.useHebrewDate && event.hebrewDate
                                                        ? formatHebrewDate(event.hebrewDate)
                                                        : format(nextDate, 'MMM d, yyyy')}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {daysUntil === 0
                                                        ? '🎉 Today!'
                                                        : daysUntil === 1
                                                            ? '⏰ Tomorrow'
                                                            : daysUntil < 0
                                                                ? `${Math.abs(daysUntil)} days ago`
                                                                : `${daysUntil} days away`}
                                                </p>
                                                {event.reminderConfig?.isEnabled && (
                                                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                                        <Bell className="h-3 w-3" />
                                                        {event.reminderConfig.reminders.length} reminder(s)
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    onClick={() => handleEditEvent(event)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDeleteEvent(event.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground text-center">
                        {filteredEvents.length} of {events.length} events
                    </div>
                </div>
            </div>

            <EventModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEventToEdit(null);
                }}
                onSave={handleSaveEvent}
                initialDate={selectedDate}
                eventToEdit={eventToEdit}
            />

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
}

