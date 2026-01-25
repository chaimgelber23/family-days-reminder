'use client';

import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse bg-muted rounded ${className || ''}`} />;
}

export function DashboardSkeleton() {
    return (
        <div className="container mx-auto p-6 h-screen flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Family Days Reminder</h1>
                <Button variant="outline" size="icon" disabled>
                    <Settings className="h-5 w-5" />
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
                {/* Calendar Skeleton */}
                <div className="lg:col-span-3 h-full bg-card border rounded-lg p-4">
                    {/* Calendar header */}
                    <div className="flex justify-between items-center mb-4">
                        <Skeleton className="h-8 w-32" />
                        <div className="flex gap-2">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                        </div>
                    </div>
                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Day headers */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center text-sm text-muted-foreground py-2">
                                {day}
                            </div>
                        ))}
                        {/* Calendar cells */}
                        {Array.from({ length: 35 }).map((_, i) => (
                            <Skeleton key={i} className="h-20 w-full" />
                        ))}
                    </div>
                </div>

                {/* Sidebar Skeleton */}
                <div className="bg-card border rounded-lg p-4 h-full overflow-hidden flex flex-col">
                    <Skeleton className="h-6 w-24 mb-4" />

                    {/* Filter buttons skeleton */}
                    <div className="space-y-2 mb-4">
                        <div className="flex gap-1">
                            <Skeleton className="h-7 w-12" />
                            <Skeleton className="h-7 w-16" />
                            <Skeleton className="h-7 w-16" />
                        </div>
                        <div className="flex gap-1">
                            <Skeleton className="h-7 w-16" />
                            <Skeleton className="h-7 w-20" />
                            <Skeleton className="h-7 w-24" />
                        </div>
                    </div>

                    {/* Event cards skeleton */}
                    <div className="flex-1 space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="p-3 rounded-lg border">
                                <Skeleton className="h-5 w-3/4 mb-2" />
                                <Skeleton className="h-4 w-1/2 mb-1" />
                                <Skeleton className="h-3 w-1/3" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
