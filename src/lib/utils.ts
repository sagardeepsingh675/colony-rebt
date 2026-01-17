import { type ClassValue, clsx } from 'clsx';

// Combine class names
export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}

// Calculate prorated rent for first month
export function calculateProratedRent(monthlyRent: number, startDate: Date): number {
    const dayOfMonth = startDate.getDate();
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    if (dayOfMonth === 1) {
        return monthlyRent;
    }

    const remainingDays = daysInMonth - dayOfMonth + 1;
    return Math.round((monthlyRent / daysInMonth) * remainingDays * 100) / 100;
}

// Format currency in INR
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

// Format date for display
export function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

// Get days remaining in the current month from a date
export function getDaysRemainingInMonth(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayOfMonth = date.getDate();
    return daysInMonth - dayOfMonth + 1;
}

// Get total days in a month
export function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

// Calculate expected rent for a rental (considering prorated first month)
export function calculateExpectedRent(
    monthlyRent: number,
    firstMonthRent: number,
    contractStartDate: string
): number {
    const startDate = new Date(contractStartDate);
    const today = new Date();

    // If contract hasn't started yet, no rent expected
    if (startDate > today) {
        return 0;
    }

    // Calculate months difference
    const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
    const currentMonth = today.getFullYear() * 12 + today.getMonth();
    const monthsDiff = currentMonth - startMonth;

    if (monthsDiff === 0) {
        // Still in the first month
        return firstMonthRent;
    }

    // First month + subsequent full months
    return firstMonthRent + (monthsDiff * monthlyRent);
}

// Generate room numbers
export function generateRoomNumbers(
    count: number,
    prefix: string = 'R',
    startFrom: number = 1
): string[] {
    return Array.from({ length: count }, (_, i) => `${prefix}${startFrom + i}`);
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
