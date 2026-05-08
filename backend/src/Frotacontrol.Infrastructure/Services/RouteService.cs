using Microsoft.EntityFrameworkCore;
using Frotacontrol.Core.DTOs.Routes;
using Frotacontrol.Core.DTOs.StopPoints;
using Frotacontrol.Core.Entities;
using Frotacontrol.Core.Interfaces;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Infrastructure.Services;

public class RouteService : IRouteService
{
    private readonly AppDbContext _db;

    public RouteService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<RouteDto>> GetRoutesAsync(string companyId, string sectorId, string? date = null, int? shift = null, string? vehicleId = null)
    {
        var query = _db.Routes
            .Include(r => r.Trips).ThenInclude(t => t.Stops)
            .Where(r => r.CompanyId == companyId && r.SectorId == sectorId);

        if (!string.IsNullOrWhiteSpace(date))
            query = query.Where(r => r.Date == date || r.IsFixed);
        if (shift.HasValue)
            query = query.Where(r => r.Shift == shift.Value);
        if (!string.IsNullOrWhiteSpace(vehicleId))
            query = query.Where(r => r.VehicleId == vehicleId);

        var routes = await query.OrderBy(r => r.Date).ThenBy(r => r.Shift).ToListAsync();
        return routes.Select(ToDto).ToList();
    }

    public async Task<RouteDto?> GetRouteAsync(string companyId, string sectorId, Guid routeId)
    {
        var route = await _db.Routes
            .Include(r => r.Trips).ThenInclude(t => t.Stops)
            .FirstOrDefaultAsync(r => r.Id == routeId && r.CompanyId == companyId && r.SectorId == sectorId);

        return route == null ? null : ToDto(route);
    }

    public async Task<RouteDto> CreateRouteAsync(string companyId, string sectorId, CreateRouteRequest request)
    {
        var route = new Route
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SectorId = sectorId,
            VehicleId = request.VehicleId,
            Date = request.Date,
            Shift = request.Shift,
            IsFixed = request.IsFixed
        };

        foreach (var t in request.Trips)
        {
            var trip = new RouteTrip
            {
                Id = Guid.NewGuid(),
                Name = t.Name,
                SortOrder = t.SortOrder
            };

            foreach (var s in t.Stops)
            {
                trip.Stops.Add(new RouteTripStop
                {
                    SortOrder = s.SortOrder,
                    Name = s.Name,
                    PlannedArrival = s.PlannedArrival,
                    PlannedDeparture = s.PlannedDeparture
                });
            }

            route.Trips.Add(trip);
        }

        _db.Routes.Add(route);
        await _db.SaveChangesAsync();
        return ToDto(route);
    }

    public async Task<RouteDto> UpdateRouteAsync(string companyId, string sectorId, Guid routeId, UpdateRouteRequest request)
    {
        var route = await _db.Routes
            .Include(r => r.Trips).ThenInclude(t => t.Stops)
            .FirstOrDefaultAsync(r => r.Id == routeId && r.CompanyId == companyId && r.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"Route '{routeId}' not found");

        // Remove old trips and stops
        _db.RouteTripStops.RemoveRange(route.Trips.SelectMany(t => t.Stops));
        _db.RouteTrips.RemoveRange(route.Trips);
        route.Trips.Clear();

        // Update fields
        route.VehicleId = request.VehicleId;
        route.Date = request.Date;
        route.Shift = request.Shift;
        route.IsFixed = request.IsFixed;

        // Add new trips
        foreach (var t in request.Trips)
        {
            var trip = new RouteTrip
            {
                Id = Guid.NewGuid(),
                Name = t.Name,
                SortOrder = t.SortOrder
            };

            foreach (var s in t.Stops)
            {
                trip.Stops.Add(new RouteTripStop
                {
                    SortOrder = s.SortOrder,
                    Name = s.Name,
                    PlannedArrival = s.PlannedArrival,
                    PlannedDeparture = s.PlannedDeparture
                });
            }

            route.Trips.Add(trip);
        }

        await _db.SaveChangesAsync();
        return ToDto(route);
    }

    public async Task DeleteRouteAsync(string companyId, string sectorId, Guid routeId)
    {
        var route = await _db.Routes
            .Include(r => r.Trips).ThenInclude(t => t.Stops)
            .FirstOrDefaultAsync(r => r.Id == routeId && r.CompanyId == companyId && r.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"Route '{routeId}' not found");

        _db.RouteTripStops.RemoveRange(route.Trips.SelectMany(t => t.Stops));
        _db.RouteTrips.RemoveRange(route.Trips);
        _db.Routes.Remove(route);
        await _db.SaveChangesAsync();
    }

    // ---- Stop Points (scoped by company + sector) ----

    public async Task<List<StopPointDto>> GetStopPointsAsync(string companyId, string sectorId)
    {
        return await _db.StopPoints
            .Where(sp => sp.CompanyId == companyId && sp.SectorId == sectorId && sp.IsActive)
            .OrderBy(sp => sp.Name)
            .Select(sp => new StopPointDto
            {
                Id = sp.Id,
                CompanyId = sp.CompanyId,
                SectorId = sp.SectorId,
                Name = sp.Name,
                IsActive = sp.IsActive
            })
            .ToListAsync();
    }

    public async Task<StopPointDto> CreateStopPointAsync(string companyId, string sectorId, CreateStopPointRequest request)
    {
        var sp = new StopPoint
        {
            CompanyId = companyId,
            SectorId = sectorId,
            Name = request.Name,
            IsActive = true
        };
        _db.StopPoints.Add(sp);
        await _db.SaveChangesAsync();
        return new StopPointDto { Id = sp.Id, CompanyId = sp.CompanyId, SectorId = sp.SectorId, Name = sp.Name, IsActive = sp.IsActive };
    }

    public async Task<StopPointDto> UpdateStopPointAsync(string companyId, string sectorId, int id, UpdateStopPointRequest request)
    {
        var sp = await _db.StopPoints.FirstOrDefaultAsync(s =>
            s.Id == id && s.CompanyId == companyId && s.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"StopPoint '{id}' not found");

        sp.Name = request.Name;
        await _db.SaveChangesAsync();
        return new StopPointDto { Id = sp.Id, CompanyId = sp.CompanyId, SectorId = sp.SectorId, Name = sp.Name, IsActive = sp.IsActive };
    }

    public async Task DeleteStopPointAsync(string companyId, string sectorId, int id)
    {
        var sp = await _db.StopPoints.FirstOrDefaultAsync(s =>
            s.Id == id && s.CompanyId == companyId && s.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"StopPoint '{id}' not found");
        sp.IsActive = false;
        await _db.SaveChangesAsync();
    }

    private static RouteDto ToDto(Route route) => new()
    {
        Id = route.Id,
        CompanyId = route.CompanyId,
        SectorId = route.SectorId,
        VehicleId = route.VehicleId,
        Date = route.Date,
        Shift = route.Shift,
        IsFixed = route.IsFixed,
        Trips = route.Trips.OrderBy(t => t.SortOrder).Select(t => new TripDto
        {
            Id = t.Id,
            Name = t.Name,
            SortOrder = t.SortOrder,
            Stops = t.Stops.OrderBy(s => s.SortOrder).Select(s => new TripStopDto
            {
                Id = s.Id,
                SortOrder = s.SortOrder,
                Name = s.Name,
                PlannedArrival = s.PlannedArrival,
                PlannedDeparture = s.PlannedDeparture
            }).ToList()
        }).ToList()
    };
}
