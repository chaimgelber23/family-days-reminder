'use client';

import { useState } from 'react';
import { EventCalendar } from '@/components/EventCalendar';
import { EventModal } from '@/components/EventModal';
import { FamilyEvent } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { SettingsModal } from '@/components/SettingsModal';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
    const [events, setEvents] = useState<FamilyEvent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const handleAddEvent = (date: Date) => {
        setSelectedDate(date);
        setIsModalOpen(true);
    };

    const handleSaveEvent = async (data: any) => {
        // Transform form data to FamilyEvent
        const newEvent: FamilyEvent = {
            id: Math.random().toString(36).substr(2, 9), // Temp ID
            userId: 'current-user', // specific user ID would go here
            title: data.title,
            type: data.type,
            gregorianDate: Timestamp.fromDate(new Date(data.gregorianDate)),
            useHebrewDate: data.useHebrewDate,
            isRecurring: data.isRecurring,
            // Hebrew date logic would go here if useHebrewDate is true
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        setEvents([...events, newEvent]);
        setIsModalOpen(false);
    };

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

                {/* Sidebar */}
                <div className="bg-card border rounded-lg p-4 h-full overflow-auto">
                    <h3 className="font-semibold text-lg mb-4">Upcoming Events</h3>
                    <div className="text-muted-foreground text-sm text-center py-8">
                        No upcoming events
                    </div>
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
