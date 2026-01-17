import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { RentalHistory, RoomWithRental, CompanyWithHistory } from '../types/database';
import { calculateExpectedRent } from '../lib/utils';

export function useCompanyHistory(colonyId: string | undefined) {
    const [history, setHistory] = useState<RentalHistory[]>([]);
    const [currentRooms, setCurrentRooms] = useState<RoomWithRental[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!colonyId) return;

        setLoading(true);
        setError(null);

        // Fetch rental history for this colony
        const { data: historyData, error: historyError } = await supabase
            .from('rental_history')
            .select('*')
            .eq('colony_id', colonyId)
            .order('contract_end_date', { ascending: false });

        if (historyError) {
            setError(historyError.message);
            setLoading(false);
            return;
        }

        // Fetch current rooms with rentals
        const { data: roomsData, error: roomsError } = await supabase
            .from('rooms')
            .select('*')
            .eq('colony_id', colonyId);

        if (roomsError) {
            setError(roomsError.message);
            setLoading(false);
            return;
        }

        // Fetch current rentals
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

        setHistory(historyData || []);
        setCurrentRooms(roomsWithRentals);
        setLoading(false);
    }, [colonyId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Build company list with both current and historical data
    const companies: CompanyWithHistory[] = useMemo(() => {
        const companyMap = new Map<string, CompanyWithHistory>();

        // Add current rentals
        currentRooms.forEach(room => {
            if (room.rental) {
                const name = room.rental.company_name;
                const existing = companyMap.get(name);

                if (existing) {
                    existing.currentRooms.push(room);
                    existing.isActive = true;
                } else {
                    companyMap.set(name, {
                        company_name: name,
                        currentRooms: [room],
                        historyRecords: [],
                        totalRoomsEver: 0,
                        totalPaidEver: 0,
                        totalExpectedEver: 0,
                        isActive: true,
                    });
                }
            }
        });

        // Add history records
        history.forEach(record => {
            const name = record.company_name;
            const existing = companyMap.get(name);

            if (existing) {
                existing.historyRecords.push(record);
            } else {
                companyMap.set(name, {
                    company_name: name,
                    currentRooms: [],
                    historyRecords: [record],
                    totalRoomsEver: 0,
                    totalPaidEver: 0,
                    totalExpectedEver: 0,
                    isActive: false,
                });
            }
        });

        // Calculate totals
        return Array.from(companyMap.values()).map(company => {
            let totalPaid = 0;
            let totalExpected = 0;

            // Add from current rooms
            company.currentRooms.forEach(room => {
                if (room.rental) {
                    totalPaid += Number(room.rental.paid_amount);
                    totalExpected += calculateExpectedRent(
                        Number(room.rental.monthly_rent),
                        Number(room.rental.first_month_rent),
                        room.rental.contract_start_date
                    );
                }
            });

            // Add from history
            company.historyRecords.forEach(record => {
                totalPaid += Number(record.total_paid);
                totalExpected += Number(record.total_expected);
            });

            return {
                ...company,
                totalRoomsEver: company.currentRooms.length + company.historyRecords.length,
                totalPaidEver: totalPaid,
                totalExpectedEver: totalExpected,
            };
        }).sort((a, b) => {
            // Active companies first, then by total rooms
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
            return b.totalRoomsEver - a.totalRoomsEver;
        });
    }, [currentRooms, history]);

    return {
        companies,
        history,
        loading,
        error,
        refetch: fetchData,
    };
}

// Helper to calculate duration between dates
export function calculateDuration(startDate: string, endDate: string): { days: number; months: number; text: string } {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);

    let text = '';
    if (diffMonths > 0) {
        text = `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
        const remainingDays = diffDays % 30;
        if (remainingDays > 0) {
            text += ` ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
        }
    } else {
        text = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    }

    return { days: diffDays, months: diffMonths, text };
}
