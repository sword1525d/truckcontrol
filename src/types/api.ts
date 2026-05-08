// Tipos centralizados espelhando os DTOs do backend .NET

// ====== Auth ======

export interface LoginRequest {
  email?: string;
  matricula?: string;
  companyId?: string;
  sectorId?: string;
  password: string;
}

export interface UserProfile {
  id: string;
  name: string;
  matricula: string;
  companyId: string;
  sectorId: string;
  isAdmin: boolean;
  isTruck: boolean;
  isOP: boolean;
  shift: number;
  photoURL?: string;
  email?: string;
  sectorIds: string[];
  groupId?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  profile: UserProfile;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}

// ====== Companies / Sectors / Groups ======

export interface CompanyDto {
  id: string;
  name: string;
}

export interface SectorDto {
  id: string;
  companyId: string;
  name: string;
}

export interface GroupDto {
  id: string;
  companyId: string;
  name: string;
}

// ====== Users ======

export interface UserDto {
  id: string;
  companyId: string;
  sectorId: string;
  name: string;
  matricula: string;
  shift: number;
  isAdmin: boolean;
  isTruck: boolean;
  isOP: boolean;
  photoURL?: string;
  email?: string;
  permitidos?: string;
}

export interface CreateUserRequest {
  matricula: string;
  name: string;
  password: string;
  role?: string;
  shift: number;
  isAdmin: boolean;
  isTruck: boolean;
  isOP: boolean;
  photoURL?: string;
  email?: string;
  permitidos?: string;
}

// ====== Vehicles ======

export type VehicleStatus = 'PARADO' | 'EM_CORRIDA' | 'EM_MANUTENCAO' | 'BLOQUEADO_CHECKLIST';

export interface VehicleDto {
  id: string;
  companyId: string;
  sectorId: string;
  model: string;
  isTruck: boolean;
  status: VehicleStatus;
  lastMileage?: number;
  imageUrl?: string;
}

export interface CreateVehicleRequest {
  vehicleId: string;
  model: string;
  isTruck: boolean;
  imageUrl?: string;
}

export interface UpdateVehicleStatusRequest {
  status: VehicleStatus;
}

// ====== Maintenance ======

export interface MaintenanceRecordDto {
  id: string;
  vehicleId: string;
  startTime: string;
  endTime?: string;
  notes?: string;
}

export interface StartMaintenanceRequest {
  notes?: string;
}

// ====== Runs ======

export interface RunDto {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  routeId?: string;
  tripId?: string;
  tripName?: string;
  shift: number;
  startMileage: number;
  startTime: string;
  endTime?: string;
  endMileage?: number;
  status: RunStatus;
  stops: RunStopDto[];
  locationHistory?: GpsPointDto[];
}

export interface RunSummaryDto {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  routeId?: string;
  tripName?: string;
  startTime: string;
  status: RunStatus;
  startMileage: number;
  endMileage?: number;
  stopCount: number;
  completedStops: number;
}

export type RunStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

export interface RunStopDto {
  id: number;
  sortOrder: number;
  name: string;
  status: StopStatus;
  plannedArrival?: string;
  plannedDeparture?: string;
  arrivalTime?: string;
  departureTime?: string;
  collectedOccupiedCars?: number;
  collectedEmptyCars?: number;
  mileageAtStop?: number;
  occupancy?: number;
  observation?: string;
}

export type StopStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

export interface GpsPointDto {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface CreateRunRequest {
  driverId: string;
  driverName: string;
  vehicleId: string;
  routeId?: string;
  tripId?: string;
  tripName?: string;
  shift: number;
  startMileage: number;
  stops: CreateRunStopRequest[];
}

export interface CreateRunStopRequest {
  name: string;
  plannedArrival?: string;
  plannedDeparture?: string;
}

export interface UpdateStopArrivalRequest {
  arrivalTime?: string;
}

export interface UpdateStopDepartureRequest {
  departureTime?: string;
  collectedOccupiedCars?: number;
  collectedEmptyCars?: number;
  mileageAtStop?: number;
  occupancy?: number;
  observation?: string;
}

export interface EndRunRequest {
  endMileage?: number;
}

export interface GpsLocationRequest {
  locations: GpsPointDto[];
}

export interface TakeoverRequest {
  driverId: string;
  driverName: string;
}

// ====== Routes ======

export interface RouteDto {
  id: string;
  companyId: string;
  sectorId: string;
  vehicleId: string;
  date: string;
  shift: number;
  isFixed: boolean;
  trips: TripDto[];
}

export interface TripDto {
  id: string;
  name: string;
  sortOrder: number;
  stops: TripStopDto[];
}

export interface TripStopDto {
  id: number;
  sortOrder: number;
  name: string;
  plannedArrival: string;
  plannedDeparture: string;
}

export interface CreateRouteRequest {
  vehicleId: string;
  date: string;
  shift: number;
  isFixed: boolean;
  trips: CreateTripRequest[];
}

export interface CreateTripRequest {
  name: string;
  sortOrder: number;
  stops: CreateTripStopRequest[];
}

export interface CreateTripStopRequest {
  name: string;
  plannedArrival: string;
  plannedDeparture: string;
  sortOrder: number;
}

// ====== Stop Points ======

export interface StopPointDto {
  id: number;
  companyId: string;
  sectorId: string;
  name: string;
  isActive: boolean;
}

export interface CreateStopPointRequest {
  name: string;
}

// ====== Checklists ======

export interface ChecklistDto {
  id: string;
  vehicleId: string;
  driverId: string;
  driverName: string;
  timestamp: string;
  companyId: string;
  sectorId: string;
  items: ChecklistItemDto[];
}

export interface ChecklistItemDto {
  id: number;
  itemId: string;
  location: string;
  title: string;
  description: string;
  status: ChecklistItemStatus;
  observation?: string;
  images?: string;
}

export type ChecklistItemStatus = 'conforme' | 'nao_conforme' | 'na';

export interface SubmitChecklistRequest {
  driverId: string;
  driverName: string;
  items: SubmitChecklistItemRequest[];
}

export interface SubmitChecklistItemRequest {
  itemId: string;
  location: string;
  title: string;
  description: string;
  status: ChecklistItemStatus;
  observation?: string;
  images?: string[];
}

// ====== Refuels ======

export interface RefuelDto {
  id: string;
  companyId: string;
  sectorId: string;
  vehicleId: string;
  driverId: string;
  driverName: string;
  liters: number;
  amount: number;
  timestamp: string;
}

export interface CreateRefuelRequest {
  vehicleId: string;
  driverId: string;
  driverName: string;
  liters: number;
  amount: number;
}

// ====== Managers ======

export interface ManagerDto {
  id: string;
  companyId: string;
  sectorId: string;
  name: string;
  email: string;
}

export interface CreateManagerRequest {
  name: string;
  email: string;
}

// ====== Fuel Cards ======

export interface FuelCardDto {
  vehicleId: string;
  companyId: string;
  sectorId: string;
  balance: number;
  recharges: FuelCardRechargeDto[];
}

export interface FuelCardRechargeDto {
  id: string;
  fuelCardVehicleId: string;
  amount: number;
  date: string;
  time: string;
  responsible: string;
}

export interface CreateFuelCardRequest {
  vehicleId: string;
  initialBalance: number;
}

export interface RechargeFuelCardRequest {
  amount: number;
  responsible: string;
}
