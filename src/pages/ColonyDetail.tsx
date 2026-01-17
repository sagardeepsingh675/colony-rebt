import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useColony } from '../hooks/useColonies';
import { useRooms } from '../hooks/useRooms';
import { useDashboard } from '../hooks/useDashboard';
import { useRentals } from '../hooks/useRentals';
import { useCompanyHistory, calculateDuration } from '../hooks/useCompanyHistory';
import { Modal } from '../components/ui/Modal';
import { PageLoading } from '../components/ui/Loading';
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { formatCurrency, calculateProratedRent, formatDate } from '../lib/utils';

type FilterStatus = 'all' | 'Free' | 'Rented';
type ViewMode = 'rooms' | 'companies' | 'history';

export function ColonyDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { colony, loading: colonyLoading } = useColony(id);
    const { rooms, loading: roomsLoading, createRoom, generateRooms, bulkAllotRooms, endRental, deleteRoom, fetchRooms } = useRooms(id);
    const { stats, companySummaries, refetch } = useDashboard(id);
    const { updatePayment, updateCompanyPayment } = useRentals();
    const { companies: companiesWithHistory, loading: historyLoading, refetch: refetchHistory } = useCompanyHistory(id);

    // State
    const [viewMode, setViewMode] = useState<ViewMode>('rooms');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [filterCompany, setFilterCompany] = useState<string>('');
    const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());

    // Modals
    const [showAddRoom, setShowAddRoom] = useState(false);
    const [showGenerateRooms, setShowGenerateRooms] = useState(false);
    const [showBulkAllot, setShowBulkAllot] = useState(false);
    const [showAddToCompany, setShowAddToCompany] = useState<string | null>(null);
    const [showPayment, setShowPayment] = useState<{ roomId: string; rentalId: string } | null>(null);
    const [showCompanyPayment, setShowCompanyPayment] = useState<string | null>(null);

    // Form state
    const [roomNumber, setRoomNumber] = useState('');
    const [generateCount, setGenerateCount] = useState(10);
    const [generatePrefix, setGeneratePrefix] = useState('R');
    const [generateStart, setGenerateStart] = useState(1);
    const [companyName, setCompanyName] = useState('');
    const [monthlyRent, setMonthlyRent] = useState('');
    const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Filtered rooms
    const filteredRooms = useMemo(() => {
        return rooms.filter(room => {
            if (filterStatus !== 'all' && room.status !== filterStatus) return false;
            if (filterCompany && room.rental?.company_name !== filterCompany) return false;
            return true;
        });
    }, [rooms, filterStatus, filterCompany]);

    // Get unique companies for filter
    const companies = useMemo(() => {
        const companySet = new Set<string>();
        rooms.forEach(room => {
            if (room.rental) {
                companySet.add(room.rental.company_name);
            }
        });
        return Array.from(companySet).sort();
    }, [rooms]);

    // Handlers
    const handleAddRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        await createRoom(roomNumber);
        setRoomNumber('');
        setShowAddRoom(false);
        setSubmitting(false);
    };

    const handleGenerateRooms = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        await generateRooms(generateCount, generatePrefix, generateStart);
        setShowGenerateRooms(false);
        setSubmitting(false);
    };

    const handleBulkAllot = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        await bulkAllotRooms(
            Array.from(selectedRooms),
            companyName,
            parseFloat(monthlyRent),
            contractDate
        );
        setSelectedRooms(new Set());
        setCompanyName('');
        setMonthlyRent('');
        setShowBulkAllot(false);
        setShowAddToCompany(null);
        setSubmitting(false);
        refetch();
    };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showPayment) return;
        setSubmitting(true);
        await updatePayment(showPayment.rentalId, parseFloat(paymentAmount), () => {
            fetchRooms();
            refetch();
        });
        setPaymentAmount('');
        setShowPayment(null);
        setSubmitting(false);
    };

    const handleCompanyPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showCompanyPayment || !id) return;
        setSubmitting(true);
        await updateCompanyPayment(showCompanyPayment, id, parseFloat(paymentAmount));
        setPaymentAmount('');
        setShowCompanyPayment(null);
        setSubmitting(false);
        fetchRooms();
        refetch();
    };

    const handleEndRental = async (roomId: string, rentalId: string) => {
        if (confirm('Are you sure you want to end this rental?')) {
            await endRental(roomId, rentalId);
            refetch();
            fetchRooms();
        }
    };

    const handleDeleteRoom = async (roomId: string) => {
        if (confirm('Are you sure you want to delete this room?')) {
            await deleteRoom(roomId);
        }
    };

    const toggleRoomSelection = (roomId: string) => {
        const newSelected = new Set(selectedRooms);
        if (newSelected.has(roomId)) {
            newSelected.delete(roomId);
        } else {
            newSelected.add(roomId);
        }
        setSelectedRooms(newSelected);
    };

    const selectAllFreeRooms = () => {
        const freeRoomIds = rooms.filter(r => r.status === 'Free').map(r => r.id);
        setSelectedRooms(new Set(freeRoomIds));
    };

    const clearSelection = () => {
        setSelectedRooms(new Set());
    };

    // Calculate prorated preview
    const proratedPreview = useMemo(() => {
        if (!monthlyRent || !contractDate) return null;
        const rent = parseFloat(monthlyRent);
        if (isNaN(rent)) return null;
        return calculateProratedRent(rent, new Date(contractDate));
    }, [monthlyRent, contractDate]);

    if (colonyLoading || roomsLoading) {
        return <PageLoading />;
    }

    if (!colony) {
        return (
            <EmptyState
                icon={EmptyStateIcons.colony}
                title="Colony not found"
                description="This colony doesn't exist or you don't have access to it"
                action={<Link to="/colonies" className="btn-primary">Back to Colonies</Link>}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        to="/colonies"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{colony.name}</h1>
                        {colony.address && <p className="text-slate-500">{colony.address}</p>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => setShowAddRoom(true)} className="btn-outline">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Room
                    </button>
                    <button onClick={() => setShowGenerateRooms(true)} className="btn-outline">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Generate Rooms
                    </button>
                    {selectedRooms.size > 0 && (
                        <button onClick={() => setShowBulkAllot(true)} className="btn-primary">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Allot {selectedRooms.size} Rooms
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Total Rooms</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalRooms}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Rented</p>
                    <p className="text-2xl font-bold text-rose-600">{stats.rentedRooms}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Free</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.freeRooms}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Expected Rent</p>
                    <p className="text-2xl font-bold text-indigo-600">{formatCurrency(stats.totalExpectedRent)}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Received</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalReceived)}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Pending</p>
                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.totalPending)}</p>
                </div>
            </div>

            {/* View Toggle & Filters */}
            <div className="card p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* View Mode */}
                    <div className="flex rounded-xl bg-slate-100 p-1">
                        <button
                            onClick={() => setViewMode('rooms')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'rooms'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Rooms
                        </button>
                        <button
                            onClick={() => setViewMode('companies')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'companies'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Companies
                        </button>
                        <button
                            onClick={() => { setViewMode('history'); refetchHistory(); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'history'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            History
                        </button>
                    </div>

                    {viewMode === 'rooms' && (
                        <>
                            {/* Status Filter */}
                            <div className="flex gap-2">
                                {(['all', 'Free', 'Rented'] as const).map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === status
                                            ? status === 'Free'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : status === 'Rented'
                                                    ? 'bg-rose-100 text-rose-700'
                                                    : 'bg-slate-200 text-slate-700'
                                            : 'text-slate-500 hover:bg-slate-100'
                                            }`}
                                    >
                                        {status === 'all' ? 'All' : status}
                                    </button>
                                ))}
                            </div>

                            {/* Company Filter */}
                            {companies.length > 0 && (
                                <select
                                    value={filterCompany}
                                    onChange={(e) => setFilterCompany(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                                >
                                    <option value="">All Companies</option>
                                    {companies.map((company) => (
                                        <option key={company} value={company}>
                                            {company}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {/* Selection Actions */}
                            <div className="flex gap-2 lg:ml-auto">
                                <button onClick={selectAllFreeRooms} className="btn-ghost text-sm">
                                    Select All Free
                                </button>
                                {selectedRooms.size > 0 && (
                                    <button onClick={clearSelection} className="btn-ghost text-sm text-rose-600">
                                        Clear ({selectedRooms.size})
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            {viewMode === 'rooms' ? (
                /* Rooms Grid */
                rooms.length === 0 ? (
                    <EmptyState
                        icon={EmptyStateIcons.room}
                        title="No rooms yet"
                        description="Add rooms manually or generate them in bulk"
                        action={
                            <div className="flex gap-3">
                                <button onClick={() => setShowAddRoom(true)} className="btn-outline">
                                    Add Room
                                </button>
                                <button onClick={() => setShowGenerateRooms(true)} className="btn-primary">
                                    Generate Rooms
                                </button>
                            </div>
                        }
                    />
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {filteredRooms.map((room) => (
                            <div
                                key={room.id}
                                className={`card p-4 cursor-pointer transition-all ${selectedRooms.has(room.id)
                                    ? 'ring-2 ring-indigo-500 bg-indigo-50'
                                    : room.status === 'Free'
                                        ? 'hover:bg-emerald-50'
                                        : 'hover:bg-rose-50'
                                    }`}
                                onClick={() => room.status === 'Free' && toggleRoomSelection(room.id)}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    {room.status === 'Free' && (
                                        <input
                                            type="checkbox"
                                            checked={selectedRooms.has(room.id)}
                                            onChange={() => toggleRoomSelection(room.id)}
                                            className="checkbox"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    )}
                                    <span
                                        className={`badge ${room.status === 'Free' ? 'badge-success' : 'badge-danger'
                                            } ml-auto`}
                                    >
                                        {room.status}
                                    </span>
                                </div>
                                <p className="font-semibold text-slate-900">{room.room_number}</p>
                                {room.rental && (
                                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                                        <p className="truncate font-medium text-slate-700">{room.rental.company_name}</p>
                                        <p>{formatCurrency(Number(room.rental.monthly_rent))}/mo</p>
                                        <p className="text-emerald-600">Paid: {formatCurrency(Number(room.rental.paid_amount))}</p>
                                    </div>
                                )}
                                {room.rental && (
                                    <div className="mt-3 flex gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowPayment({ roomId: room.id, rentalId: room.rental!.id });
                                            }}
                                            className="flex-1 px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                                        >
                                            Payment
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEndRental(room.id, room.rental!.id);
                                            }}
                                            className="px-2 py-1 text-xs font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100"
                                        >
                                            End
                                        </button>
                                    </div>
                                )}
                                {room.status === 'Free' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRoom(room.id);
                                        }}
                                        className="mt-3 w-full px-2 py-1 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )
            ) : (
                /* Companies View */
                companySummaries.length === 0 ? (
                    <EmptyState
                        icon={EmptyStateIcons.search}
                        title="No companies yet"
                        description="Allot rooms to companies to see them here"
                    />
                ) : (
                    <div className="space-y-4">
                        {companySummaries.map((company) => (
                            <div key={company.company_name} className="card">
                                <div className="p-6 flex flex-col lg:flex-row lg:items-center gap-4">
                                    <div className="flex-1">
                                        <button
                                            onClick={() => { setViewMode('history'); setFilterCompany(company.company_name); refetchHistory(); }}
                                            className="text-lg font-semibold text-slate-900 hover:text-indigo-600 transition-colors text-left"
                                            title="Click to view company history"
                                        >
                                            {company.company_name}
                                            <svg className="inline-block w-4 h-4 ml-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </button>
                                        <p className="text-slate-500">{company.roomsCount} rooms</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <p className="text-sm text-slate-500">Expected</p>
                                            <p className="text-lg font-semibold text-indigo-600">{formatCurrency(company.totalExpectedRent)}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500">Paid</p>
                                            <p className="text-lg font-semibold text-emerald-600">{formatCurrency(company.totalPaid)}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500">Pending</p>
                                            <p className="text-lg font-semibold text-amber-600">{formatCurrency(company.totalPending)}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const existingRoom = company.rooms[0];
                                                if (existingRoom?.rental) {
                                                    setCompanyName(company.company_name);
                                                    setMonthlyRent(String(existingRoom.rental.monthly_rent));
                                                    setContractDate(new Date().toISOString().split('T')[0]);
                                                }
                                                setShowAddToCompany(company.company_name);
                                            }}
                                            className="btn-outline"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Add Rooms
                                        </button>
                                        <button
                                            onClick={() => setShowCompanyPayment(company.company_name)}
                                            className="btn-primary"
                                        >
                                            Record Payment
                                        </button>
                                    </div>
                                </div>
                                <div className="border-t border-slate-100 p-4 bg-slate-50">
                                    <p className="text-xs text-slate-500 mb-2">Click on a room to remove it from this company</p>
                                    <div className="flex flex-wrap gap-2">
                                        {company.rooms.map((room) => (
                                            <button
                                                key={room.id}
                                                onClick={() => room.rental && handleEndRental(room.id, room.rental.id)}
                                                className="group inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 hover:bg-rose-100 hover:text-rose-800 transition-colors"
                                                title="Click to remove from company"
                                            >
                                                {room.room_number}
                                                <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* History View */}
            {viewMode === 'history' && (
                historyLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="spinner"></div>
                    </div>
                ) : companiesWithHistory.length === 0 ? (
                    <EmptyState
                        icon={EmptyStateIcons.search}
                        title="No history yet"
                        description="Company rental history will appear here after rentals are ended"
                    />
                ) : (
                    <div className="space-y-4">
                        {/* Company filter header */}
                        {filterCompany && (
                            <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg">
                                <span className="text-sm text-indigo-700">Showing history for:</span>
                                <span className="font-medium text-indigo-900">{filterCompany}</span>
                                <button
                                    onClick={() => setFilterCompany('')}
                                    className="ml-auto text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                >
                                    Show all companies
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                        {companiesWithHistory
                            .filter(c => !filterCompany || c.company_name === filterCompany)
                            .map((company) => (
                                <div key={company.company_name} className="card overflow-hidden">
                                    {/* Company Header */}
                                    <div className={`p-6 ${company.isActive ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-semibold text-slate-900">{company.company_name}</h3>
                                                    {company.isActive ? (
                                                        <span className="badge badge-success">Active</span>
                                                    ) : (
                                                        <span className="badge badge-warning">Inactive</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-500 mt-1">
                                                    {company.currentRooms.length > 0 && (
                                                        <span className="text-emerald-600 font-medium">{company.currentRooms.length} current rooms • </span>
                                                    )}
                                                    {company.historyRecords.length} past rentals
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4 text-center">
                                                <div>
                                                    <p className="text-sm text-slate-500">Total Ever</p>
                                                    <p className="text-lg font-semibold text-indigo-600">{formatCurrency(company.totalExpectedEver)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-slate-500">Paid Ever</p>
                                                    <p className="text-lg font-semibold text-emerald-600">{formatCurrency(company.totalPaidEver)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-slate-500">Pending</p>
                                                    <p className={`text-lg font-semibold ${company.totalExpectedEver - company.totalPaidEver > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {formatCurrency(company.totalExpectedEver - company.totalPaidEver)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Warning for inactive companies with pending dues */}
                                    {!company.isActive && (company.totalExpectedEver - company.totalPaidEver) > 0 && (
                                        <div className="px-6 py-3 bg-rose-50 border-t border-rose-100">
                                            <div className="flex items-center gap-2 text-rose-700">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <span className="font-medium">
                                                    Company left with pending dues of {formatCurrency(company.totalExpectedEver - company.totalPaidEver)}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Current Rooms */}
                                    {company.currentRooms.length > 0 && (
                                        <div className="p-4 border-b border-slate-100 bg-white">
                                            <p className="text-sm font-medium text-slate-700 mb-2">Current Rooms</p>
                                            <div className="flex flex-wrap gap-2">
                                                {company.currentRooms.map((room) => (
                                                    <div key={room.id} className="px-3 py-2 rounded-lg bg-emerald-100 text-emerald-800 text-sm">
                                                        <span className="font-medium">{room.room_number}</span>
                                                        {room.rental && (
                                                            <span className="text-emerald-600 ml-2">
                                                                {formatCurrency(Number(room.rental.monthly_rent))}/mo
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* History Records */}
                                    {company.historyRecords.length > 0 && (
                                        <div className="p-4 bg-white">
                                            <p className="text-sm font-medium text-slate-700 mb-3">Rental History</p>
                                            <div className="space-y-2">
                                                {company.historyRecords.map((record) => {
                                                    const duration = calculateDuration(record.contract_start_date, record.contract_end_date);
                                                    const balance = Number(record.total_expected) - Number(record.total_paid);
                                                    return (
                                                        <div
                                                            key={record.id}
                                                            className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                                                        >
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-slate-900">{record.room_number}</span>
                                                                    <span className="text-xs text-slate-500">•</span>
                                                                    <span className="text-sm text-slate-600">{duration.text}</span>
                                                                </div>
                                                                <p className="text-xs text-slate-500">
                                                                    {formatDate(record.contract_start_date)} → {formatDate(record.contract_end_date)}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-sm">
                                                                <div className="text-right">
                                                                    <p className="text-slate-500">Expected</p>
                                                                    <p className="font-medium">{formatCurrency(Number(record.total_expected))}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-slate-500">Paid</p>
                                                                    <p className="font-medium text-emerald-600">{formatCurrency(Number(record.total_paid))}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-slate-500">Balance</p>
                                                                    <p className={`font-medium ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                        {formatCurrency(balance)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                )
            )}

            {/* Add Room Modal */}
            <Modal isOpen={showAddRoom} onClose={() => setShowAddRoom(false)} title="Add Room" size="sm">
                <form onSubmit={handleAddRoom} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Room Number</label>
                        <input
                            type="text"
                            value={roomNumber}
                            onChange={(e) => setRoomNumber(e.target.value)}
                            className="input"
                            placeholder="e.g., R101"
                            required
                        />
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setShowAddRoom(false)} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="btn-primary flex-1">
                            {submitting ? 'Adding...' : 'Add Room'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Generate Rooms Modal */}
            <Modal isOpen={showGenerateRooms} onClose={() => setShowGenerateRooms(false)} title="Generate Rooms">
                <form onSubmit={handleGenerateRooms} className="space-y-5">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Prefix</label>
                            <input
                                type="text"
                                value={generatePrefix}
                                onChange={(e) => setGeneratePrefix(e.target.value)}
                                className="input"
                                placeholder="R"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Start From</label>
                            <input
                                type="number"
                                value={generateStart}
                                onChange={(e) => setGenerateStart(parseInt(e.target.value))}
                                className="input"
                                min={1}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Count</label>
                            <input
                                type="number"
                                value={generateCount}
                                onChange={(e) => setGenerateCount(parseInt(e.target.value))}
                                className="input"
                                min={1}
                                max={100}
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-600">
                            This will create rooms: <strong>{generatePrefix}{generateStart}</strong> to{' '}
                            <strong>{generatePrefix}{generateStart + generateCount - 1}</strong>
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setShowGenerateRooms(false)} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="btn-primary flex-1">
                            {submitting ? 'Generating...' : `Generate ${generateCount} Rooms`}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Bulk Allotment Modal */}
            <Modal isOpen={showBulkAllot} onClose={() => setShowBulkAllot(false)} title="Bulk Room Allotment" size="lg">
                <form onSubmit={handleBulkAllot} className="space-y-5">
                    <div className="p-4 bg-indigo-50 rounded-xl">
                        <p className="text-sm text-indigo-700">
                            Allotting <strong>{selectedRooms.size} rooms</strong> to a company
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="input"
                            placeholder="e.g., ABC Corporation"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Monthly Rent Per Room</label>
                            <input
                                type="number"
                                value={monthlyRent}
                                onChange={(e) => setMonthlyRent(e.target.value)}
                                className="input"
                                placeholder="e.g., 5000"
                                min={0}
                                step={0.01}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Contract Start Date</label>
                            <input
                                type="date"
                                value={contractDate}
                                onChange={(e) => setContractDate(e.target.value)}
                                className="input"
                                required
                            />
                        </div>
                    </div>

                    {proratedPreview !== null && (
                        <div className="p-4 bg-amber-50 rounded-xl space-y-2">
                            <p className="text-sm font-medium text-amber-800">Prorated Calculation</p>
                            <p className="text-sm text-amber-700">
                                First month rent: <strong>{formatCurrency(proratedPreview)}</strong>
                                {proratedPreview !== parseFloat(monthlyRent) && (
                                    <span className="text-amber-600"> (Prorated from {formatCurrency(parseFloat(monthlyRent))})</span>
                                )}
                            </p>
                            <p className="text-sm text-amber-700">
                                Total first month: <strong>{formatCurrency(proratedPreview * selectedRooms.size)}</strong>
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button type="button" onClick={() => setShowBulkAllot(false)} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="btn-primary flex-1">
                            {submitting ? 'Allotting...' : 'Confirm Allotment'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Payment Modal */}
            <Modal isOpen={!!showPayment} onClose={() => setShowPayment(null)} title="Record Payment" size="sm">
                <form onSubmit={handlePayment} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Payment Amount</label>
                        <input
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="input"
                            placeholder="Enter amount"
                            min={0}
                            step={0.01}
                            required
                        />
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setShowPayment(null)} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="btn-success flex-1">
                            {submitting ? 'Recording...' : 'Record Payment'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Company Payment Modal */}
            <Modal isOpen={!!showCompanyPayment} onClose={() => setShowCompanyPayment(null)} title={`Payment for ${showCompanyPayment}`} size="sm">
                <form onSubmit={handleCompanyPayment} className="space-y-5">
                    <p className="text-sm text-slate-500">
                        This payment will be distributed proportionally across all rooms rented by this company.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Payment Amount</label>
                        <input
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="input"
                            placeholder="Enter total amount"
                            min={0}
                            step={0.01}
                            required
                        />
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setShowCompanyPayment(null)} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="btn-success flex-1">
                            {submitting ? 'Recording...' : 'Record Payment'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Add Rooms to Company Modal */}
            <Modal
                isOpen={!!showAddToCompany}
                onClose={() => {
                    setShowAddToCompany(null);
                    setSelectedRooms(new Set());
                }}
                title={`Add Rooms to ${showAddToCompany}`}
                size="lg"
            >
                <div className="space-y-5">
                    <div className="p-4 bg-indigo-50 rounded-xl">
                        <p className="text-sm text-indigo-700">
                            Select free rooms to add to <strong>{showAddToCompany}</strong>
                        </p>
                    </div>

                    {/* Free rooms grid */}
                    <div className="max-h-64 overflow-y-auto">
                        {rooms.filter(r => r.status === 'Free').length === 0 ? (
                            <p className="text-center text-slate-500 py-8">No free rooms available</p>
                        ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                {rooms.filter(r => r.status === 'Free').map((room) => (
                                    <button
                                        key={room.id}
                                        onClick={() => toggleRoomSelection(room.id)}
                                        className={`p-3 rounded-lg text-sm font-medium transition-all ${selectedRooms.has(room.id)
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        {room.room_number}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedRooms.size > 0 && (
                        <div className="p-4 bg-emerald-50 rounded-xl">
                            <p className="text-sm text-emerald-700">
                                <strong>{selectedRooms.size} rooms</strong> selected
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Monthly Rent Per Room</label>
                            <input
                                type="number"
                                value={monthlyRent}
                                onChange={(e) => setMonthlyRent(e.target.value)}
                                className="input"
                                placeholder="e.g., 5000"
                                min={0}
                                step={0.01}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Contract Start Date</label>
                            <input
                                type="date"
                                value={contractDate}
                                onChange={(e) => setContractDate(e.target.value)}
                                className="input"
                            />
                        </div>
                    </div>

                    {proratedPreview !== null && selectedRooms.size > 0 && (
                        <div className="p-4 bg-amber-50 rounded-xl space-y-2">
                            <p className="text-sm font-medium text-amber-800">Prorated Calculation</p>
                            <p className="text-sm text-amber-700">
                                First month rent per room: <strong>{formatCurrency(proratedPreview)}</strong>
                            </p>
                            <p className="text-sm text-amber-700">
                                Total first month: <strong>{formatCurrency(proratedPreview * selectedRooms.size)}</strong>
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setShowAddToCompany(null);
                                setSelectedRooms(new Set());
                            }}
                            className="btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={submitting || selectedRooms.size === 0 || !monthlyRent}
                            onClick={async () => {
                                if (!showAddToCompany || selectedRooms.size === 0) return;
                                setSubmitting(true);
                                await bulkAllotRooms(
                                    Array.from(selectedRooms),
                                    showAddToCompany,
                                    parseFloat(monthlyRent),
                                    contractDate
                                );
                                setSelectedRooms(new Set());
                                setShowAddToCompany(null);
                                setSubmitting(false);
                                refetch();
                            }}
                            className="btn-primary flex-1"
                        >
                            {submitting ? 'Adding...' : `Add ${selectedRooms.size} Rooms`}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
