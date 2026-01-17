import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Rental } from '../types/database';

export function useRentals() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updatePayment = useCallback(async (
        rentalId: string,
        amount: number,
        onSuccess?: (rental: Rental) => void
    ) => {
        setLoading(true);
        setError(null);

        // Get current rental
        const { data: rental, error: fetchError } = await supabase
            .from('rentals')
            .select('*')
            .eq('id', rentalId)
            .single();

        if (fetchError) {
            setError(fetchError.message);
            setLoading(false);
            return { error: fetchError };
        }

        // Update paid amount
        const newPaidAmount = (rental?.paid_amount || 0) + amount;

        const { data, error: updateError } = await supabase
            .from('rentals')
            .update({ paid_amount: newPaidAmount })
            .eq('id', rentalId)
            .select()
            .single();

        if (updateError) {
            setError(updateError.message);
            setLoading(false);
            return { error: updateError };
        }

        setLoading(false);
        if (onSuccess && data) {
            onSuccess(data);
        }

        return { data, error: null };
    }, []);

    const updateCompanyPayment = useCallback(async (
        companyName: string,
        colonyId: string,
        amount: number
    ) => {
        setLoading(true);
        setError(null);

        // Get all rentals for this company in this colony
        const { data: rooms } = await supabase
            .from('rooms')
            .select('id')
            .eq('colony_id', colonyId);

        if (!rooms?.length) {
            setLoading(false);
            return { error: new Error('No rooms found') };
        }

        const roomIds = rooms.map(r => r.id);

        const { data: rentals, error: fetchError } = await supabase
            .from('rentals')
            .select('*')
            .in('room_id', roomIds)
            .eq('company_name', companyName);

        if (fetchError) {
            setError(fetchError.message);
            setLoading(false);
            return { error: fetchError };
        }

        if (!rentals?.length) {
            setLoading(false);
            return { error: new Error('No rentals found for this company') };
        }

        // Distribute payment proportionally across all rentals
        const totalMonthlyRent = rentals.reduce((sum, r) => sum + Number(r.monthly_rent), 0);

        const updates = rentals.map(rental => ({
            id: rental.id,
            paid_amount: Number(rental.paid_amount) + (amount * Number(rental.monthly_rent) / totalMonthlyRent),
        }));

        // Update all rentals
        for (const update of updates) {
            await supabase
                .from('rentals')
                .update({ paid_amount: update.paid_amount })
                .eq('id', update.id);
        }

        setLoading(false);
        return { error: null };
    }, []);

    return {
        loading,
        error,
        updatePayment,
        updateCompanyPayment,
    };
}
