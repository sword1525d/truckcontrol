export type StopStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

export type LocationPoint = { latitude: number; longitude: number; timestamp: string };

export type Stop = {
    name: string;
    status: StopStatus;
    arrivalTime: string | null;
    departureTime: string | null;
    collectedOccupiedCars: number | null;
    collectedEmptyCars: number | null;
    mileageAtStop: number | null;
    occupancy: number | null;
    observation?: string;
};

export type Run = {
    id: string;
    driverId: string;
    driverName: string;
    vehicleId: string;
    startMileage: number;
    startTime: string;
    endTime?: string | null;
    endMileage?: number | null;
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
    stops: Stop[];
    sectorId?: string;
    locationHistory?: LocationPoint[];
    tripId?: string | null;
    tripName?: string | null;
    shift?: string;
    routeId?: string | null;
};

export type AggregatedRun = {
    key: string;
    driverId: string;
    driverName: string;
    vehicleId: string;
    shift: string;
    date: string;
    startTime: string;
    endTime: string | null;
    totalDistance: number;
    totalDuration?: number;
    stops: Stop[];
    locationHistory: LocationPoint[];
    originalRuns: Run[];
    startMileage: number;
    status: 'IN_PROGRESS' | 'COMPLETED' | 'PLANNED';
    plannedRoute?: PlannedRoute;
};

export type PlannedStop = { name: string; plannedArrival: string; plannedDeparture: string };
export type PlannedTrip = { id: string; name: string; stops: PlannedStop[] };
export type PlannedRoute = { id: string; vehicleId: string; trips: PlannedTrip[]; date: string; shift: string; isFixed?: boolean };

export type Segment = {
    id: string;
    label: string;
    path: [number, number][];
    color: string;
    travelTime: string;
    stopTime: string;
    distance?: string;
    opacity?: number;
};

export type SectorInfo = { id: string; name: string };

export const SHIFT_NUM_TO_NAME: Record<number, string> = { 0: '1° NORMAL', 1: '2° NORMAL', 2: '1° ESPECIAL', 3: '2° ESPECIAL' };
export const SHIFT_NAME_TO_NUM: Record<string, number> = { '1° NORMAL': 0, '2° NORMAL': 1, '1° ESPECIAL': 2, '2° ESPECIAL': 3 };

export const SEGMENT_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#6366f1', '#f59e0b', '#14b8a6', '#d946ef'];
