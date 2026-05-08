using Microsoft.EntityFrameworkCore;
using Frotacontrol.Core.DTOs.Maintenance;
using Frotacontrol.Core.Entities;
using Frotacontrol.Core.Enums;
using Frotacontrol.Core.Interfaces;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Infrastructure.Services;

public class MaintenanceService : IMaintenanceService
{
    private readonly AppDbContext _db;

    public MaintenanceService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<MaintenanceRecordDto>> GetHistoryAsync(string companyId, string sectorId, string vehicleId)
    {
        return await _db.MaintenanceRecords
            .Where(m => m.VehicleId == vehicleId
                && m.Vehicle.CompanyId == companyId
                && m.Vehicle.SectorId == sectorId)
            .OrderByDescending(m => m.StartTime)
            .Select(m => ToDto(m))
            .ToListAsync();
    }

    public async Task<MaintenanceRecordDto> StartAsync(string companyId, string sectorId, string vehicleId, string? notes)
    {
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v =>
            v.Id == vehicleId && v.CompanyId == companyId && v.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"Vehicle '{vehicleId}' not found");

        if (vehicle.Status != VehicleStatus.PARADO)
            throw new InvalidOperationException($"Vehicle must be PARADO to start maintenance. Current status: {vehicle.Status}");

        vehicle.Status = VehicleStatus.EM_MANUTENCAO;

        var record = new MaintenanceRecord
        {
            Id = Guid.NewGuid(),
            VehicleId = vehicleId,
            StartTime = DateTimeOffset.UtcNow,
            Notes = notes
        };

        _db.MaintenanceRecords.Add(record);
        await _db.SaveChangesAsync();
        return ToDto(record);
    }

    public async Task<MaintenanceRecordDto> EndAsync(string companyId, string sectorId, string vehicleId)
    {
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v =>
            v.Id == vehicleId && v.CompanyId == companyId && v.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"Vehicle '{vehicleId}' not found");

        if (vehicle.Status != VehicleStatus.EM_MANUTENCAO)
            throw new InvalidOperationException($"Vehicle must be EM_MANUTENCAO to end maintenance. Current status: {vehicle.Status}");

        var openRecord = await _db.MaintenanceRecords
            .Where(m => m.VehicleId == vehicleId && m.EndTime == null)
            .OrderByDescending(m => m.StartTime)
            .FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("No open maintenance record found");

        vehicle.Status = VehicleStatus.PARADO;
        openRecord.EndTime = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return ToDto(openRecord);
    }

    private static MaintenanceRecordDto ToDto(MaintenanceRecord m) => new()
    {
        Id = m.Id,
        VehicleId = m.VehicleId,
        StartTime = m.StartTime,
        EndTime = m.EndTime,
        Notes = m.Notes
    };
}
