'use client';

import React, { useState, useEffect } from 'react';
import {
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    format,
    isSameMonth,
    isSameDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from './ui/button';
import {
    toHebrewDate,
    formatHebrewDate,
    getJewishHolidays
} from '@/lib/hebrew-calendar';
import { HebrewDateInfo, FamilyEvent } from '@/lib/types';
import { cn } from '@/lib/utils'; // Assuming standard ShadCN utils exist

interface EventCalendarProps {
    events: FamilyEvent[];
    onAddEvent: (date: Date) => void;
    onViewEvent: (event: FamilyEvent) => void;
}

export function EventCalendar({ events, onAddEvent, onViewEvent }: EventCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

    // Calendar navigation
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const jumpToToday = () => setCurrentDate(new Date());

    // Generate calendar grid
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    // Get holidays for this year (and next if we cross year boundary)
    // This is a simple optimization, could be better managed
    const currentYear = currentDate.getFullYear();
    // We'll calculate holidays on the fly for the displayed month days mostly

    return (
        <div className="flex flex-col h-full bg-background border rounded-lg shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center space-x-4">
                    <h2 className="text-2xl font-bold capitalize">
                        {format(currentDate, 'MMMM yyyy')}
                    </h2>
                    <div className="text-muted-foreground hidden md:block">
                        {/* Show Hebrew month range roughly */}
                        {formatHebrewDate(toHebrewDate(monthStart)).split(' ').slice(1).join(' ')} -
                        {formatHebrewDate(toHebrewDate(monthEnd)).split(' ').slice(1).join(' ')}
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={jumpToToday}>
                        Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button onClick={() => onAddEvent(new Date())}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Event
                    </Button>
                </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 border-b bg-muted/40 text-center py-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 grid-rows-auto flex-1 auto-rows-fr">
                {calendarDays.map((day, dayIdx) => {
                    const hebrewDate = toHebrewDate(day);
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, monthStart);

                    // Filter events for this day
                    const dayEvents = events.filter(e => {
                        const eventDate = e.gregorianDate.toDate();

                        if (e.isRecurring) {
                            // For recurring events, match month and day (ignore year)
                            return eventDate.getMonth() === day.getMonth() &&
                                eventDate.getDate() === day.getDate();
                        }
                        // For non-recurring events, exact date match
                        return isSameDay(eventDate, day);
                    });

                    return (
                        <div
                            key={day.toString()}
                            className={cn(
                                "min-h-[120px] p-2 border-b border-r relative group transition-colors",
                                !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                                isToday && "bg-accent/10",
                                dayIdx % 7 === 6 && "border-r-0" // Remove right border for last col
                            )}
                            onClick={() => onAddEvent(day)}
                            onMouseEnter={() => setHoveredDate(day)}
                            onMouseLeave={() => setHoveredDate(null)}
                        >
                            {/* Date Header: Gregorian Left, Hebrew Right */}
                            <div className="flex justify-between items-start mb-1">
                                <span className={cn(
                                    "text-sm font-semibold h-7 w-7 flex items-center justify-center rounded-full",
                                    isToday ? "bg-primary text-primary-foreground" : ""
                                )}>
                                    {format(day, 'd')}
                                </span>
                                <span className="text-xs text-muted-foreground text-right font-hebrew">
                                    {hebrewDate.day} {hebrewDate.monthName}
                                </span>
                            </div>

                            {/* Events List */}
                            <div className="space-y-1 mt-1">
                                {dayEvents.map(event => (
                                    <div
                                        key={event.id}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onViewEvent(event);
                                        }}
                                        className={cn(
                                            "text-xs px-2 py-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity",
                                            event.type === 'birthday' && "bg-pink-100 text-pink-700 border-pink-200 border",
                                            event.type === 'anniversary' && "bg-blue-100 text-blue-700 border-blue-200 border",
                                            event.type === 'holiday' && "bg-purple-100 text-purple-700 border-purple-200 border",
                                            event.type === 'yahrzeit' && "bg-gray-100 text-gray-700 border-gray-200 border",
                                            event.type === 'custom' && "bg-green-100 text-green-700 border-green-200 border",
                                        )}
                                    >
                                        {event.title}
                                    </div>
                                ))}
                            </div>

                            {/* Hover Add Button */}
                            <button
                                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-muted-foreground"
                                aria-label="Add event"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
