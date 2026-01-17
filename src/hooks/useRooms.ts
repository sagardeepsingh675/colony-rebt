import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Room, RoomWithRental, Rental } from '../types/database';
import { calculateProratedRent } from '../lib/utils';

export function useRooms(colonyId: string | undefined) {
    const [rooms, setRooms] = useState<RoomWithRental[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRooms = useCallback(async () => {
        if (!colonyId) return;

        setLoading(true);
        setError(null);

        // Fetch rooms with their rentals
        const { data: roomsData, error: roomsError } = await supabase
            .from('rooms')
            .select('*')
            .eq('colony_id', colonyId)
            .order('room_number', { ascending: true });

        if (roomsError) {
            setError(roomsError.message);
            setLoading(false);
            return;
        }

        // Fetch rentals for these rooms
        const roomIds = roomsData?.map(r => r.id) || [];
        const { data: rentalsData } = await supabase
            .from('rentals')
            .select('*')
            .in('room_id', roomIds);

        // Combine rooms with their rentals
        const roomsWithRentals = roomsData?.map(room => ({
            ...room,
            rental: rentalsData?.find(r => r.room_id === room.id) || null,
        })) || [];

        setRooms(roomsWithRentals);
        setLoading(false);
    }, [colonyId]);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    const createRoom = async (roomNumber: string) => {
        if (!colonyId) return { error: new Error('No colony ID') };

        const { data, error } = await supabase
            .from('rooms')
            .insert({
                colony_id: colonyId,
                room_number: roomNumber,
                status: 'Free' as const,
            })
            .select()
            .single();

        if (!error && data) {
            setRooms((prev) => [...prev, { ...data, rental: null }].sort((a, b) =>
                a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
            ));
        }

        return { data, error };
    };

    const generateRooms = async (count: number, prefix: string = 'R', startFrom: number = 1) => {
        if (!colonyId) return { error: new Error('No colony ID') };

        const roomNumbers = Array.from({ length: count }, (_, i) => ({
            colony_id: colonyId,
            room_number: `${prefix}${startFrom + i}`,
            status: 'Free' as const,
        }));

        const { data, error } = await supabase
            .from('rooms')
            .insert(roomNumbers)
            .select();

        if (!error && data) {
            const newRooms = data.map(room => ({ ...room, rental: null }));
            setRooms((prev) => [...prev, ...newRooms].sort((a, b) =>
                a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
            ));
        }

        return { data, error };
    };

    const bulkAllotRooms = async (
        roomIds: string[],
        companyName: string,
        monthlyRent: number,
        contractStartDate: string
    ) => {
        const startDate = new Date(contractStartDate);
        const firstMonthRent = calculateProratedRent(monthlyRent, startDate);

        // Create rentals
        const rentals = roomIds.map(roomId => ({
            room_id: roomId,
            company_name: companyName,
            monthly_rent: monthlyRent,
            contract_start_date: contractStartDate,
            first_month_rent: firstMonthRent,
            paid_amount: 0,
        }));

        const { data: rentalData, error: rentalError } = await supabase
            .from('rentals')
            .insert(rentals)
            .select();

        if (rentalError) {
            return { error: rentalError };
        }

        // Update room statuses
        const { error: roomError } = await supabase
            .from('rooms')
            .update({ status: 'Rented' as const })
            .in('id', roomIds);

        if (roomError) {
            return { error: roomError };
        }

        // Update local state
        setRooms((prev) =>
            prev.map((room) => {
                if (roomIds.includes(room.id)) {
                    const rental = rentalData?.find((r) => r.room_id === room.id);
                    return { ...room, status: 'Rented' as const, rental: rental || null };
                }
                return room;
            })
        );

        return { data: rentalData, error: null };
    };

    const endRental = async (roomId: string, rentalId: string) => {
        // Fetch the rental data directly from the database to ensure we have fresh data
        const { data: rentalResult, error: fetchError } = await supabase
            .from('rentals')
            .select('*')
            .eq('id', rentalId)
            .single();

        const rentalData = rentalResult as Rental | null;

        if (fetchError || !rentalData) {
            console.error('Error fetching rental:', fetchError);
            return { error: fetchError || new Error('Rental not found') };
        }

        // Fetch room data
        const { data: roomResult, error: roomFetchError } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single();

        const roomData = roomResult as Room | null;

        if (roomFetchError || !roomData) {
            console.error('Error fetching room:', roomFetchError);
            return { error: roomFetchError || new Error('Room not found') };
        }

        // Calculate total expected rent
        const startDate = new Date(rentalData.contract_start_date);
        const endDate = new Date();
        const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
        const endMonth = endDate.getFullYear() * 12 + endDate.getMonth();
        const monthsDiff = endMonth - startMonth;

        let totalExpected = Number(rentalData.first_month_rent);
        if (monthsDiff > 0) {
            totalExpected += monthsDiff * Number(rentalData.monthly_rent);
        }

        // Save to rental_history
        const { error: historyError } = await supabase
            .from('rental_history')
            .insert({
                room_id: roomId,
                colony_id: colonyId!,
                room_number: roomData.room_number,
                company_name: rentalData.company_name,
                monthly_rent: Number(rentalData.monthly_rent),
                first_month_rent: Number(rentalData.first_month_rent),
                contract_start_date: rentalData.contract_start_date,
                contract_end_date: new Date().toISOString().split('T')[0],
                total_paid: Number(rentalData.paid_amount),
                total_expected: totalExpected,
            });

        if (historyError) {
            console.error('Error saving to history:', historyError);
            // Continue anyway - we still want to end the rental
        }

        // Delete rental
        const { error: rentalError } = await supabase
            .from('rentals')
            .delete()
            .eq('id', rentalId);

        if (rentalError) {
            return { error: rentalError };
        }

        // Update room status
        const { error: roomError } = await supabase
            .from('rooms')
            .update({ status: 'Free' as const })
            .eq('id', roomId);

        if (roomError) {
            return { error: roomError };
        }

        // Update local state
        setRooms((prev) =>
            prev.map((r) => {
                if (r.id === roomId) {
                    return { ...r, status: 'Free' as const, rental: null };
                }
                return r;
            })
        );

        return { error: null };
    };

    const deleteRoom = async (id: string) => {
        const { error } = await supabase
            .from('rooms')
            .delete()
            .eq('id', id);

        if (!error) {
            setRooms((prev) => prev.filter((r) => r.id !== id));
        }

        return { error };
    };

    return {
        rooms,
        loading,
        error,
        fetchRooms,
        createRoom,
        generateRooms,
        bulkAllotRooms,
        endRental,
        deleteRoom,
    };
}
