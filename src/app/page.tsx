'use client';

import { useState, useEffect } from 'react';
import { EventCalendar } from '@/components/EventCalendar';
import { EventModal, EventFormData } from '@/components/EventModal';
import { FamilyEvent } from '@/lib/types';
import { Timestamp, collection, doc, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { SettingsModal } from '@/components/SettingsModal';
import { EventsPanel } from '@/components/EventsPanel';
import { Settings, Trash2, Calendar, Bell, PanelRightOpen, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser } from '@/firebase/provider';
import { toHebrewDate } from '@/lib/hebrew-calendar';
import { format, differenceInDays, isBefore, startOfDay, parseISO } from 'date-fns';

export default function DashboardPage() {
    const [events, setEvents] = useState<FamilyEvent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [eventToEdit, setEventToEdit] = useState<FamilyEvent | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
        setIsPanelOpen(false); // Close the panel when editing
    };

    // Helper to parse date string without timezone issues
    const parseDateString = (dateStr: string): Date => {
        // Parse YYYY-MM-DD and create date in local timezone
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0); // noon to avoid DST issues
    };

    // Check for duplicate events
    const checkDuplicate = (title: string, gregorianDate: Date, excludeEventId?: string): FamilyEvent | null => {
        const dateStr = format(gregorianDate, 'yyyy-MM-dd');
        return events.find(e => {
            if (excludeEventId && e.id === excludeEventId) return false;
            const eventDateStr = format(e.gregorianDate.toDate(), 'yyyy-MM-dd');
            return e.title.toLowerCase() === title.toLowerCase() && eventDateStr === dateStr;
        }) || null;
    };

    const handleSaveEvent = async (data: EventFormData, existingEventId?: string) => {
        if (!user) {
            alert('Please sign in to save events');
            return;
        }

        // Parse the date correctly to avoid timezone issues
        const gregorianDate = parseDateString(data.gregorianDate);
        const hebrewDate = toHebrewDate(gregorianDate);

        // Check for duplicates (only for new events, not edits)
        if (!existingEventId) {
            const duplicate = checkDuplicate(data.title, gregorianDate);
            if (duplicate) {
                const confirmed = confirm(
                    `An event "${duplicate.title}" already exists on this date. Do you want to add a duplicate?`
                );
                if (!confirmed) {
                    throw new Error('User cancelled duplicate');
                }
            }
        }

        const eventId = existingEventId || crypto.randomUUID();

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
            reminderConfig: data.enableReminders ? {
                isEnabled: true,
                reminders: data.reminders,
            } : {
                isEnabled: false,
                reminders: [],
            },
        };

        // Add Hebrew date info if using Hebrew calendar
        if (data.useHebrewDate) {
            eventData.hebrewDate = {
                day: data.hebrewDay || hebrewDate.day,
                month: hebrewDate.month,
                year: data.hebrewYear || hebrewDate.year,
                monthName: data.hebrewMonth || hebrewDate.monthName,
            };
            eventData.originalHebrewYear = data.hebrewYear || hebrewDate.year;
        }

        try {
            await setDoc(doc(firestore, 'events', eventId), eventData);
            setIsModalOpen(false);
            setEventToEdit(null);
        } catch (error) {
            console.error('Error saving event:', error);
            alert('Failed to save event. Please try again.');
            throw error;
        }
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

    // Calculate upcoming events (next 60 days)
    const getUpcomingEvents = () => {
        const today = startOfDay(new Date());
        const upcoming: { event: FamilyEvent; nextDate: Date; daysUntil: number }[] = [];

        events.forEach(event => {
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

            if (daysUntil >= 0 && daysUntil <= 60) {
                upcoming.push({ event, nextDate: nextOccurrence, daysUntil });
            }
        });

        return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    };

    const upcomingEvents = getUpcomingEvents();

    if (isUserLoading || isLoading) {
        return (
            <div className="container mx-auto p-6 h-screen flex items-center justify-center">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="container mx-auto p-6 h-screen flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Family Days Reminder</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsPanelOpen(true)}>
                        <PanelRightOpen className="h-4 w-4 mr-2" />
                        All Events
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setIsSettingsOpen(true)}>
                        <Settings className="h-5 w-5" />
                    </Button>
                </div>
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

                {/* Sidebar - Upcoming Events */}
                <div className="bg-card border rounded-lg p-4 h-full overflow-auto">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Upcoming Events
                    </h3>

                    {upcomingEvents.length === 0 ? (
                        <div className="text-muted-foreground text-sm text-center py-8">
                            No upcoming events in the next 60 days
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {upcomingEvents.map(({ event, nextDate, daysUntil }) => (
                                <div
                                    key={event.id}
                                    className="p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{event.title}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {format(nextDate, 'MMM d, yyyy')}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {daysUntil === 0
                                                    ? '🎉 Today!'
                                                    : daysUntil === 1
                                                        ? '⏰ Tomorrow'
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

            <EventsPanel
                isOpen={isPanelOpen}
                onClose={() => setIsPanelOpen(false)}
                events={events}
                onDeleteEvent={handleDeleteEvent}
                onEditEvent={handleEditEvent}
            />
        </div>
    );
}
