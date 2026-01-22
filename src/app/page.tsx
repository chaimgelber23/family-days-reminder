'use client';

import { useState, useEffect } from 'react';
import { EventCalendar } from '@/components/EventCalendar';
import { EventModal } from '@/components/EventModal';
import { FamilyEvent } from '@/lib/types';
import { Timestamp, collection, doc, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { SettingsModal } from '@/components/SettingsModal';
import { Settings, Trash2, Calendar, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser } from '@/firebase/provider';
import { toHebrewDate } from '@/lib/hebrew-calendar';
import { format, differenceInDays, isBefore, startOfDay } from 'date-fns';

export default function DashboardPage() {
    const [events, setEvents] = useState<FamilyEvent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isLoading, setIsLoading] = useState(true);

    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const router = useRouter();

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isUserLoading && !user) {
            // Check if we are already on the login page to avoid loops (though router handles this usually)
            // Wrap in setTimeout to avoid updating state/navigation during render phase if that's happening
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
                // Already handled by redirect effect above, but to be safe for local state
                setEvents([]);
                setIsLoading(false);
            }
            return;
        }

        // Real-time listener for user's events
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
        setSelectedDate(date);
        setIsModalOpen(true);
    };

    const handleSaveEvent = async (data: any) => {
        if (!user) {
            alert('Please sign in to save events');
            return;
        }

        const eventId = crypto.randomUUID();
        const gregorianDate = new Date(data.gregorianDate);
        const hebrewDate = toHebrewDate(gregorianDate);

        // Build the event object
        const newEvent: FamilyEvent = {
            id: eventId,
            userId: user.uid,
            title: data.title,
            type: data.type,
            gregorianDate: Timestamp.fromDate(gregorianDate),
            useHebrewDate: data.useHebrewDate,
            isRecurring: data.isRecurring,
            originalYear: gregorianDate.getFullYear(),
            createdAt: Timestamp.now(),
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
            newEvent.hebrewDate = {
                day: data.hebrewDay || hebrewDate.day,
                month: hebrewDate.month,
                year: data.hebrewYear || hebrewDate.year,
                monthName: data.hebrewMonth || hebrewDate.monthName,
            };
            newEvent.originalHebrewYear = data.hebrewYear || hebrewDate.year;
        }

        try {
            // Save to Firestore
            await setDoc(doc(firestore, 'events', eventId), newEvent);
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving event:', error);
            alert('Failed to save event. Please try again.');
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

    // Calculate upcoming events (next 30 days)
    const getUpcomingEvents = () => {
        const today = startOfDay(new Date());
        const upcoming: { event: FamilyEvent; nextDate: Date; daysUntil: number }[] = [];

        events.forEach(event => {
            const eventDate = event.gregorianDate.toDate();
            let nextOccurrence: Date;

            if (event.isRecurring) {
                // For recurring events, find the next occurrence this year or next
                const thisYearDate = new Date(today.getFullYear(), eventDate.getMonth(), eventDate.getDate());
                if (isBefore(thisYearDate, today)) {
                    // Already passed this year, use next year
                    nextOccurrence = new Date(today.getFullYear() + 1, eventDate.getMonth(), eventDate.getDate());
                } else {
                    nextOccurrence = thisYearDate;
                }
            } else {
                nextOccurrence = eventDate;
            }

            const daysUntil = differenceInDays(nextOccurrence, today);

            // Show events in next 60 days
            if (daysUntil >= 0 && daysUntil <= 60) {
                upcoming.push({ event, nextDate: nextOccurrence, daysUntil });
            }
        });

        // Sort by date
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



    // Better approach: Redirect effect
    useEffect(() => {
        if (!isUserLoading && !user) {
            // Import useRouter at top level first!
            // implementation detail: assumes useRouter is imported
        }
    }, [user, isUserLoading]);

    // Changing the rendering part:
    if (!user) {
        return null; // Or a loading spinner while redirecting
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
                        onViewEvent={(event) => console.log('View event', event)}
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
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <EventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveEvent}
                initialDate={selectedDate}
            />

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
}
