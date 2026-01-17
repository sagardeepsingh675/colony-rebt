// Database types for Colony Rent Manager

export interface Colony {
    id: string;
    user_id: string;
    name: string;
    address: string | null;
    created_at: string;
    updated_at: string;
}

export interface Room {
    id: string;
    colony_id: string;
    room_number: string;
    status: 'Free' | 'Rented';
    created_at: string;
    updated_at: string;
}

export interface Rental {
    id: string;
    room_id: string;
    company_name: string;
    monthly_rent: number;
    contract_start_date: string;
    first_month_rent: number;
    paid_amount: number;
    created_at: string;
    updated_at: string;
}

// Extended types with joins
export interface RoomWithRental extends Room {
    rental?: Rental | null;
}

export interface DashboardStats {
    totalRooms: number;
    rentedRooms: number;
    freeRooms: number;
    totalExpectedRent: number;
    totalReceived: number;
    totalPending: number;
}

export interface CompanySummaryData {
    company_name: string;
    roomsCount: number;
    rooms: RoomWithRental[];
    totalExpectedRent: number;
    totalPaid: number;
    totalPending: number;
}

// Form types
export interface ColonyFormData {
    name: string;
    address?: string;
}

export interface BulkAllotmentFormData {
    company_name: string;
    monthly_rent_per_room: number;
    contract_start_date: string;
}

export interface PaymentFormData {
    amount: number;
}

// Rental history for tracking completed rentals
export interface RentalHistory {
    id: string;
    room_id: string;
    colony_id: string;
    room_number: string;
    company_name: string;
    monthly_rent: number;
    first_month_rent: number;
    contract_start_date: string;
    contract_end_date: string;
    total_paid: number;
    total_expected: number;
    user_id: string;
    created_at: string;
    updated_at: string;
}

// Company with both current and historical data
export interface CompanyWithHistory {
    company_name: string;
    currentRooms: RoomWithRental[];
    historyRecords: RentalHistory[];
    totalRoomsEver: number;
    totalPaidEver: number;
    totalExpectedEver: number;
    isActive: boolean; // has current rooms
}

// Supabase Database types
export interface Database {
    public: {
        Tables: {
            colonies: {
                Row: Colony;
                Insert: Record<string, unknown>;
                Update: Record<string, unknown>;
            };
            rooms: {
                Row: Room;
                Insert: Record<string, unknown>;
                Update: Record<string, unknown>;
            };
            rentals: {
                Row: Rental;
                Insert: Record<string, unknown>;
                Update: Record<string, unknown>;
            };
            rental_history: {
                Row: RentalHistory;
                Insert: Record<string, unknown>;
                Update: Record<string, unknown>;
            };
        };
    };
}
