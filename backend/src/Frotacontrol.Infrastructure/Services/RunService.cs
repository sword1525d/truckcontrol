using Microsoft.EntityFrameworkCore;
using Frotacontrol.Core.DTOs.Runs;
using Frotacontrol.Core.Entities;
using Frotacontrol.Core.Enums;
using Frotacontrol.Core.Interfaces;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Infrastructure.Services;

public class RunService : IRunService
{
    private readonly AppDbContext _db;

    public RunService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<RunSummaryDto>> GetRunsAsync(string companyId, string sectorId, string? status = null, string? driverId = null, string? vehicleId = null, DateTimeOffset? dateFrom = null, DateTimeOffset? dateTo = null)
    {
        var query = _db.Runs.Include(r => r.Stops).AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = Enum.Parse<RunStatus>(status);
            query = query.Where(r => r.Status == s);
        }

        if (!string.IsNullOrWhiteSpace(driverId))
            query = query.Where(r => r.DriverId == driverId);
        if (!string.IsNullOrWhiteSpace(vehicleId))
            query = query.Where(r => r.VehicleId == vehicleId);
        if (dateFrom.HasValue)
            query = query.Where(r => r.StartTime >= dateFrom.Value);
        if (dateTo.HasValue)
            query = query.Where(r => r.StartTime <= dateTo.Value);

        return await query.OrderByDescending(r => r.StartTime).Select(r => ToSummary(r)).ToListAsync();
    }

    public async Task<List<RunSummaryDto>> GetActiveRunsAsync(string companyId, string sectorId, string? vehicleId = null)
    {
        var query = _db.Runs.Include(r => r.Stops)
            .Where(r => r.Status == RunStatus.IN_PROGRESS);

        if (!string.IsNullOrWhiteSpace(vehicleId))
            query = query.Where(r => r.VehicleId == vehicleId);

        return await query.OrderByDescending(r => r.StartTime).Select(r => ToSummary(r)).ToListAsync();
    }

    public async Task<RunDto?> GetRunAsync(string companyId, string sectorId, Guid runId)
    {
        var run = await _db.Runs
            .Include(r => r.Stops)
            .Include(r => r.LocationHistory.OrderByDescending(l => l.Timestamp).Take(200))
            .FirstOrDefaultAsync(r => r.Id == runId);

        return run == null ? null : ToDto(run);
    }

    public async Task<RunDto> CreateRunAsync(string companyId, string sectorId, CreateRunRequest request)
    {
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v =>
            v.Id == request.VehicleId && v.CompanyId == companyId && v.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"Vehicle '{request.VehicleId}' not found");

        // Validate vehicle status
        if (vehicle.Status == VehicleStatus.EM_MANUTENCAO)
            throw new InvalidOperationException("Vehicle is under maintenance");
        if (vehicle.Status == VehicleStatus.BLOQUEADO_CHECKLIST)
            throw new InvalidOperationException("Vehicle is blocked by checklist non-conformance");

        // Validate vehicle not already in an active run
        var activeRun = await _db.Runs.AnyAsync(r =>
            r.VehicleId == request.VehicleId && r.Status == RunStatus.IN_PROGRESS);
        if (activeRun)
            throw new InvalidOperationException("Vehicle is already in an active run");

        // Validate mileage
        if (vehicle.LastMileage.HasValue && request.StartMileage <= vehicle.LastMileage.Value)
            throw new InvalidOperationException($"Start mileage must be greater than last registered mileage ({vehicle.LastMileage})");

        // Validate checklist done today
        var todayStart = DateTimeOffset.UtcNow.Date;
        var todayEnd = todayStart.AddDays(1);
        var hasChecklist = await _db.Checklists.AnyAsync(c =>
            c.VehicleId == request.VehicleId && c.CompanyId == companyId && c.SectorId == sectorId
            && c.Timestamp >= todayStart && c.Timestamp < todayEnd);
        if (!hasChecklist)
            throw new InvalidOperationException("Daily checklist not completed for this vehicle");

        // If using a route, validate
        if (request.RouteId.HasValue)
        {
            var route = await _db.Routes.FirstOrDefaultAsync(r =>
                r.Id == request.RouteId.Value && r.CompanyId == companyId && r.SectorId == sectorId)
                ?? throw new KeyNotFoundException("Route not found");

            var todayStr = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd");
            if (route.Date != todayStr && !route.IsFixed)
                throw new InvalidOperationException("Route is not scheduled for today");
            if (route.Shift != request.Shift)
                throw new InvalidOperationException($"Route is for shift {route.Shift}, but you are on shift {request.Shift}");
        }

        var run = new Run
        {
            Id = Guid.NewGuid(),
            DriverId = request.DriverId,
            DriverName = request.DriverName,
            VehicleId = request.VehicleId,
            RouteId = request.RouteId,
            TripId = request.TripId,
            TripName = request.TripName,
            Shift = request.Shift,
            StartMileage = request.StartMileage,
            StartTime = DateTimeOffset.UtcNow,
            Status = RunStatus.IN_PROGRESS
        };

        for (int i = 0; i < request.Stops.Count; i++)
        {
            var s = request.Stops[i];
            run.Stops.Add(new RunStop
            {
                SortOrder = i,
                Name = s.Name,
                PlannedArrival = s.PlannedArrival,
                PlannedDeparture = s.PlannedDeparture,
                Status = StopStatus.PENDING
            });
        }

        vehicle.Status = VehicleStatus.EM_CORRIDA;
        vehicle.LastMileage = request.StartMileage;

        _db.Runs.Add(run);
        await _db.SaveChangesAsync();
        return ToDto(run);
    }

    public async Task<RunDto> UpdateStopArrivalAsync(string companyId, string sectorId, Guid runId, int stopIndex, UpdateStopArrivalRequest request)
    {
        var run = await GetRunOrThrow(runId);

        var stop = run.Stops.OrderBy(s => s.SortOrder).ElementAtOrDefault(stopIndex)
            ?? throw new KeyNotFoundException($"Stop index {stopIndex} not found");

        if (stop.Status != StopStatus.PENDING)
            throw new InvalidOperationException($"Stop is not PENDING. Current status: {stop.Status}");

        stop.Status = StopStatus.IN_PROGRESS;
        stop.ArrivalTime = DateTimeOffset.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.Observation))
            stop.Observation = request.Observation;

        await _db.SaveChangesAsync();
        return ToDto(run);
    }

    public async Task<RunDto> UpdateStopDepartureAsync(string companyId, string sectorId, Guid runId, int stopIndex, UpdateStopDepartureRequest request)
    {
        var run = await GetRunOrThrow(runId);

        var stops = run.Stops.OrderBy(s => s.SortOrder).ToList();
        var stop = stops.ElementAtOrDefault(stopIndex)
            ?? throw new KeyNotFoundException($"Stop index {stopIndex} not found");

        if (stop.Status != StopStatus.IN_PROGRESS)
            throw new InvalidOperationException($"Stop is not IN_PROGRESS. Current status: {stop.Status}");

        // Validate mileage progression (unless noMileage flag)
        if (!request.NoMileage && request.MileageAtStop.HasValue)
        {
            var previousStop = stops.Take(stopIndex).LastOrDefault(s => s.MileageAtStop.HasValue);
            if (previousStop != null && request.MileageAtStop.Value < previousStop.MileageAtStop!.Value)
                throw new InvalidOperationException($"Mileage must be greater than previous stop ({previousStop.MileageAtStop})");
            if (request.MileageAtStop.Value <= run.StartMileage)
                throw new InvalidOperationException($"Mileage must be greater than start mileage ({run.StartMileage})");
        }

        stop.Status = StopStatus.COMPLETED;
        stop.DepartureTime = DateTimeOffset.UtcNow;
        stop.CollectedOccupiedCars = request.CollectedOccupiedCars;
        stop.CollectedEmptyCars = request.CollectedEmptyCars;
        if (!request.NoMileage)
            stop.MileageAtStop = request.MileageAtStop;
        stop.Occupancy = request.Occupancy;
        if (!string.IsNullOrWhiteSpace(request.Observation))
            stop.Observation = request.Observation;

        await _db.SaveChangesAsync();
        return ToDto(run);
    }

    public async Task<RunDto> EndRunAsync(string companyId, string sectorId, Guid runId)
    {
        var run = await GetRunOrThrow(runId);

        if (run.Status != RunStatus.IN_PROGRESS)
            throw new InvalidOperationException($"Run is not IN_PROGRESS. Current status: {run.Status}");

        var stops = run.Stops.OrderBy(s => s.SortOrder).ToList();
        var allCompleted = stops.All(s => s.Status == StopStatus.COMPLETED);
        if (!allCompleted)
        {
            var pending = stops.Where(s => s.Status != StopStatus.COMPLETED).Select(s => s.Name);
            throw new InvalidOperationException($"Not all stops are completed. Pending: {string.Join(", ", pending)}");
        }

        run.Status = RunStatus.COMPLETED;
        run.EndTime = DateTimeOffset.UtcNow;
        run.EndMileage = stops.Last().MileageAtStop ?? run.StartMileage;

        // Update vehicle
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == run.VehicleId);
        if (vehicle != null)
        {
            vehicle.Status = VehicleStatus.PARADO;
            vehicle.LastMileage = run.EndMileage;
        }

        await _db.SaveChangesAsync();
        return ToDto(run);
    }

    public async Task<RunDto> CancelRunAsync(string companyId, string sectorId, Guid runId)
    {
        var run = await GetRunOrThrow(runId);

        if (run.Status != RunStatus.IN_PROGRESS)
            throw new InvalidOperationException("Only IN_PROGRESS runs can be canceled");

        run.Status = RunStatus.CANCELED;
        run.EndTime = DateTimeOffset.UtcNow;

        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == run.VehicleId);
        if (vehicle != null)
            vehicle.Status = VehicleStatus.PARADO;

        await _db.SaveChangesAsync();
        return ToDto(run);
    }

    public async Task AddLocationBatchAsync(string companyId, string sectorId, Guid runId, GpsLocationRequest request)
    {
        var run = await _db.Runs.FirstOrDefaultAsync(r => r.Id == runId && r.Status == RunStatus.IN_PROGRESS);
        if (run == null) return; // Silently ignore for inactive runs

        foreach (var loc in request.Locations)
        {
            _db.LocationPoints.Add(new LocationPoint
            {
                RunId = runId,
                Latitude = loc.Latitude,
                Longitude = loc.Longitude,
                Timestamp = loc.Timestamp
            });
        }

        await _db.SaveChangesAsync();
    }

    public async Task<RunDto> TakeoverRunAsync(string companyId, string sectorId, Guid runId, TakeoverRequest request)
    {
        var run = await GetRunOrThrow(runId);

        if (run.Status != RunStatus.IN_PROGRESS)
            throw new InvalidOperationException("Only IN_PROGRESS runs can be transferred");

        run.DriverId = request.NewDriverId;
        run.DriverName = request.NewDriverName;

        await _db.SaveChangesAsync();
        return ToDto(run);
    }

    private async Task<Run> GetRunOrThrow(Guid runId)
    {
        return await _db.Runs
            .Include(r => r.Stops)
            .FirstOrDefaultAsync(r => r.Id == runId)
            ?? throw new KeyNotFoundException($"Run '{runId}' not found");
    }

    private static RunSummaryDto ToSummary(Run r) => new()
    {
        Id = r.Id,
        DriverId = r.DriverId,
        DriverName = r.DriverName,
        VehicleId = r.VehicleId,
        RouteId = r.RouteId,
        TripName = r.TripName,
        StartTime = r.StartTime,
        Status = r.Status.ToString(),
        StartMileage = r.StartMileage,
        EndMileage = r.EndMileage,
        StopCount = r.Stops.Count,
        CompletedStops = r.Stops.Count(s => s.Status == StopStatus.COMPLETED)
    };

    private static RunDto ToDto(Run r) => new()
    {
        Id = r.Id,
        DriverId = r.DriverId,
        DriverName = r.DriverName,
        VehicleId = r.VehicleId,
        RouteId = r.RouteId,
        TripId = r.TripId,
        TripName = r.TripName,
        Shift = r.Shift,
        StartMileage = r.StartMileage,
        StartTime = r.StartTime,
        EndTime = r.EndTime,
        EndMileage = r.EndMileage,
        Status = r.Status.ToString(),
        Stops = r.Stops.OrderBy(s => s.SortOrder).Select(s => new RunStopDto
        {
            Id = s.Id,
            SortOrder = s.SortOrder,
            Name = s.Name,
            Status = s.Status.ToString(),
            PlannedArrival = s.PlannedArrival,
            PlannedDeparture = s.PlannedDeparture,
            ArrivalTime = s.ArrivalTime,
            DepartureTime = s.DepartureTime,
            CollectedOccupiedCars = s.CollectedOccupiedCars,
            CollectedEmptyCars = s.CollectedEmptyCars,
            MileageAtStop = s.MileageAtStop,
            Occupancy = s.Occupancy,
            Observation = s.Observation
        }).ToList(),
        LocationHistory = r.LocationHistory?.Select(l => new GpsPointDto
        {
            Latitude = l.Latitude,
            Longitude = l.Longitude,
            Timestamp = l.Timestamp
        }).ToList()
    };
}
