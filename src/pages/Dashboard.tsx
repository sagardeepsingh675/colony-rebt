import { Link } from 'react-router-dom';
import { useColonies } from '../hooks/useColonies';
import { useDashboard } from '../hooks/useDashboard';
import { PageLoading } from '../components/ui/Loading';
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { formatCurrency } from '../lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { RoomWithRental } from '../types/database';

interface OverallStats {
    totalColonies: number;
    totalRooms: number;
    rentedRooms: number;
    freeRooms: number;
    totalExpectedRent: number;
    totalReceived: number;
    totalPending: number;
}

export function DashboardPage() {
    const { colonies, loading: coloniesLoading } = useColonies();
    const [overallStats, setOverallStats] = useState<OverallStats>({
        totalColonies: 0,
        totalRooms: 0,
        rentedRooms: 0,
        freeRooms: 0,
        totalExpectedRent: 0,
        totalReceived: 0,
        totalPending: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOverallStats = async () => {
            if (colonies.length === 0) {
                setLoading(false);
                return;
            }

            const colonyIds = colonies.map(c => c.id);

            // Fetch all rooms
            const { data: rooms } = await supabase
                .from('rooms')
                .select('*')
                .in('colony_id', colonyIds);

            if (!rooms) {
                setLoading(false);
                return;
            }

            // Fetch all rentals
            const roomIds = rooms.map(r => r.id);
            const { data: rentals } = await supabase
                .from('rentals')
                .select('*')
                .in('room_id', roomIds);

            const rentedRooms = rooms.filter(r => r.status === 'Rented').length;
            const freeRooms = rooms.length - rentedRooms;

            let totalExpectedRent = 0;
            let totalReceived = 0;

            rentals?.forEach(rental => {
                // Simplified expected rent calc (first month + full months since)
                const startDate = new Date(rental.contract_start_date);
                const today = new Date();

                if (startDate <= today) {
                    const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
                    const currentMonth = today.getFullYear() * 12 + today.getMonth();
                    const monthsDiff = currentMonth - startMonth;

                    if (monthsDiff === 0) {
                        totalExpectedRent += Number(rental.first_month_rent);
                    } else {
                        totalExpectedRent += Number(rental.first_month_rent) + (monthsDiff * Number(rental.monthly_rent));
                    }
                }

                totalReceived += Number(rental.paid_amount);
            });

            setOverallStats({
                totalColonies: colonies.length,
                totalRooms: rooms.length,
                rentedRooms,
                freeRooms,
                totalExpectedRent,
                totalReceived,
                totalPending: totalExpectedRent - totalReceived,
            });

            setLoading(false);
        };

        if (!coloniesLoading) {
            fetchOverallStats();
        }
    }, [colonies, coloniesLoading]);

    if (coloniesLoading || loading) {
        return <PageLoading />;
    }

    if (colonies.length === 0) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <EmptyState
                    icon={EmptyStateIcons.colony}
                    title="Welcome to Colony Rent Manager"
                    description="Get started by creating your first colony"
                    action={
                        <Link to="/colonies" className="btn-primary">
                            Create Your First Colony
                        </Link>
                    }
                />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                <p className="text-slate-500 mt-1">Overview of all your properties</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-6 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-indigo-100 text-sm">Total Colonies</p>
                            <p className="text-3xl font-bold mt-1">{overallStats.totalColonies}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 text-sm">Total Rooms</p>
                            <p className="text-3xl font-bold text-slate-900 mt-1">{overallStats.totalRooms}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-4 text-sm">
                        <span className="text-emerald-600">
                            <span className="font-semibold">{overallStats.freeRooms}</span> Free
                        </span>
                        <span className="text-rose-600">
                            <span className="font-semibold">{overallStats.rentedRooms}</span> Rented
                        </span>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 text-sm">Expected Rent</p>
                            <p className="text-2xl font-bold text-indigo-600 mt-1">{formatCurrency(overallStats.totalExpectedRent)}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 text-sm">Pending</p>
                            <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(overallStats.totalPending)}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-emerald-600">
                        <span className="font-semibold">{formatCurrency(overallStats.totalReceived)}</span> Received
                    </div>
                </div>
            </div>

            {/* Occupancy Chart */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Occupancy Overview</h2>
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500"
                            style={{ width: `${overallStats.totalRooms > 0 ? (overallStats.rentedRooms / overallStats.totalRooms) * 100 : 0}%` }}
                        />
                    </div>
                    <span className="text-lg font-semibold text-slate-900 min-w-[60px] text-right">
                        {overallStats.totalRooms > 0 ? Math.round((overallStats.rentedRooms / overallStats.totalRooms) * 100) : 0}%
                    </span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                    {overallStats.rentedRooms} of {overallStats.totalRooms} rooms are currently rented
                </p>
            </div>

            {/* Quick Access to Colonies */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Your Colonies</h2>
                    <Link to="/colonies" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                        View All →
                    </Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {colonies.slice(0, 6).map((colony) => (
                        <Link
                            key={colony.id}
                            to={`/colonies/${colony.id}`}
                            className="card-hover p-5 flex items-center gap-4"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/30">
                                {colony.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-900 truncate">{colony.name}</h3>
                                {colony.address && (
                                    <p className="text-sm text-slate-500 truncate">{colony.address}</p>
                                )}
                            </div>
                            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
