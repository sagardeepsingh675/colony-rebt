import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DashboardStats, RoomWithRental, CompanySummaryData } from '../types/database';
import { calculateExpectedRent } from '../lib/utils';

export function useDashboard(colonyId: string | undefined) {
    const [rooms, setRooms] = useState<RoomWithRental[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!colonyId) return;

        setLoading(true);
        setError(null);

        // Fetch rooms
        const { data: roomsData, error: roomsError } = await supabase
            .from('rooms')
            .select('*')
            .eq('colony_id', colonyId);

        if (roomsError) {
            setError(roomsError.message);
            setLoading(false);
            return;
        }

        // Fetch rentals
        const roomIds = roomsData?.map(r => r.id) || [];
        const { data: rentalsData } = await supabase
            .from('rentals')
            .select('*')
            .in('room_id', roomIds);

        // Combine rooms with rentals
        const roomsWithRentals = roomsData?.map(room => ({
            ...room,
            rental: rentalsData?.find(r => r.room_id === room.id) || null,
        })) || [];

        setRooms(roomsWithRentals);
        setLoading(false);
    }, [colonyId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const stats: DashboardStats = useMemo(() => {
        const totalRooms = rooms.length;
        const rentedRooms = rooms.filter(r => r.status === 'Rented').length;
        const freeRooms = totalRooms - rentedRooms;

        let totalExpectedRent = 0;
        let totalReceived = 0;

        rooms.forEach(room => {
            if (room.rental) {
                const expected = calculateExpectedRent(
                    Number(room.rental.monthly_rent),
                    Number(room.rental.first_month_rent),
                    room.rental.contract_start_date
                );
                totalExpectedRent += expected;
                totalReceived += Number(room.rental.paid_amount);
            }
        });

        return {
            totalRooms,
            rentedRooms,
            freeRooms,
            totalExpectedRent,
            totalReceived,
            totalPending: totalExpectedRent - totalReceived,
        };
    }, [rooms]);

    const companySummaries: CompanySummaryData[] = useMemo(() => {
        const companyMap = new Map<string, RoomWithRental[]>();

        rooms.forEach(room => {
            if (room.rental) {
                const existing = companyMap.get(room.rental.company_name) || [];
                companyMap.set(room.rental.company_name, [...existing, room]);
            }
        });

        return Array.from(companyMap.entries()).map(([company_name, companyRooms]) => {
            let totalExpectedRent = 0;
            let totalPaid = 0;

            companyRooms.forEach(room => {
                if (room.rental) {
                    const expected = calculateExpectedRent(
                        Number(room.rental.monthly_rent),
                        Number(room.rental.first_month_rent),
                        room.rental.contract_start_date
                    );
                    totalExpectedRent += expected;
                    totalPaid += Number(room.rental.paid_amount);
                }
            });

            return {
                company_name,
                roomsCount: companyRooms.length,
                rooms: companyRooms,
                totalExpectedRent,
                totalPaid,
                totalPending: totalExpectedRent - totalPaid,
            };
        }).sort((a, b) => b.roomsCount - a.roomsCount);
    }, [rooms]);

    return {
        rooms,
        stats,
        companySummaries,
        loading,
        error,
        refetch: fetchData,
    };
}
