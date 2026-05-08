using Microsoft.EntityFrameworkCore;
using Frotacontrol.Core.DTOs.Refuels;
using Frotacontrol.Core.Entities;
using Frotacontrol.Core.Interfaces;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Infrastructure.Services;

public class RefuelService : IRefuelService
{
    private readonly AppDbContext _db;

    public RefuelService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<RefuelDto>> GetRefuelsAsync(string companyId, string sectorId, string? vehicleId = null, DateTimeOffset? dateFrom = null, DateTimeOffset? dateTo = null)
    {
        var query = _db.Refuels.AsQueryable();

        if (!string.IsNullOrWhiteSpace(vehicleId))
            query = query.Where(r => r.VehicleId == vehicleId);
        if (dateFrom.HasValue)
            query = query.Where(r => r.Timestamp >= dateFrom.Value);
        if (dateTo.HasValue)
            query = query.Where(r => r.Timestamp <= dateTo.Value);

        return await query.OrderByDescending(r => r.Timestamp).Select(r => new RefuelDto
        {
            Id = r.Id,
            CompanyId = r.CompanyId,
            SectorId = r.SectorId,
            VehicleId = r.VehicleId,
            DriverId = r.DriverId,
            DriverName = r.DriverName,
            Liters = r.Liters,
            Amount = r.Amount,
            Timestamp = r.Timestamp
        }).ToListAsync();
    }

    public async Task<RefuelDto> CreateRefuelAsync(string companyId, string sectorId, CreateRefuelRequest request)
    {
        var refuel = new Refuel
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SectorId = sectorId,
            VehicleId = request.VehicleId,
            DriverId = request.DriverId,
            DriverName = request.DriverName,
            Liters = request.Liters,
            Amount = request.Amount,
            Timestamp = DateTimeOffset.UtcNow
        };

        _db.Refuels.Add(refuel);
        await _db.SaveChangesAsync();

        return new RefuelDto
        {
            Id = refuel.Id,
            CompanyId = refuel.CompanyId,
            SectorId = refuel.SectorId,
            VehicleId = refuel.VehicleId,
            DriverId = refuel.DriverId,
            DriverName = refuel.DriverName,
            Liters = refuel.Liters,
            Amount = refuel.Amount,
            Timestamp = refuel.Timestamp
        };
    }
}
