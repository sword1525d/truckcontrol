using Microsoft.EntityFrameworkCore;
using Frotacontrol.Core.DTOs.Vehicles;
using Frotacontrol.Core.Entities;
using Frotacontrol.Core.Enums;
using Frotacontrol.Core.Interfaces;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Infrastructure.Services;

public class VehicleService : IVehicleService
{
    private readonly AppDbContext _db;

    public VehicleService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<VehicleDto>> GetVehiclesAsync(string companyId, string sectorId, bool? isTruck = null)
    {
        var query = _db.Vehicles.Where(v => v.CompanyId == companyId && v.SectorId == sectorId);

        if (isTruck.HasValue)
            query = query.Where(v => v.IsTruck == isTruck.Value);

        return await query
            .OrderBy(v => v.Id)
            .Select(v => ToDto(v))
            .ToListAsync();
    }

    public async Task<VehicleDto?> GetVehicleAsync(string companyId, string sectorId, string vehicleId)
    {
        var v = await _db.Vehicles.FirstOrDefaultAsync(v =>
            v.Id == vehicleId && v.CompanyId == companyId && v.SectorId == sectorId);
        return v == null ? null : ToDto(v);
    }

    public async Task<VehicleDto> CreateVehicleAsync(string companyId, string sectorId, CreateVehicleRequest request)
    {
        var vehicle = new Vehicle
        {
            Id = request.Id,
            CompanyId = companyId,
            SectorId = sectorId,
            Model = request.Model,
            IsTruck = request.IsTruck,
            Status = VehicleStatus.PARADO,
            ImageUrl = request.ImageUrl
        };

        _db.Vehicles.Add(vehicle);
        await _db.SaveChangesAsync();
        return ToDto(vehicle);
    }

    public async Task<VehicleDto> UpdateVehicleAsync(string companyId, string sectorId, string vehicleId, UpdateVehicleRequest request)
    {
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v =>
            v.Id == vehicleId && v.CompanyId == companyId && v.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"Vehicle '{vehicleId}' not found");

        vehicle.Model = request.Model;
        vehicle.ImageUrl = request.ImageUrl;
        await _db.SaveChangesAsync();
        return ToDto(vehicle);
    }

    public async Task DeleteVehicleAsync(string companyId, string sectorId, string vehicleId)
    {
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v =>
            v.Id == vehicleId && v.CompanyId == companyId && v.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"Vehicle '{vehicleId}' not found");

        _db.Vehicles.Remove(vehicle);
        await _db.SaveChangesAsync();
    }

    public async Task<VehicleDto> UpdateStatusAsync(string companyId, string sectorId, string vehicleId, UpdateVehicleStatusRequest request)
    {
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v =>
            v.Id == vehicleId && v.CompanyId == companyId && v.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"Vehicle '{vehicleId}' not found");

        if (!Enum.TryParse<VehicleStatus>(request.Status, out var newStatus))
            throw new ArgumentException($"Invalid status: {request.Status}");

        vehicle.Status = newStatus;
        await _db.SaveChangesAsync();
        return ToDto(vehicle);
    }

    public async Task<VehicleDto> UpdateMileageAsync(string companyId, string sectorId, string vehicleId, decimal lastMileage)
    {
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v =>
            v.Id == vehicleId && v.CompanyId == companyId && v.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"Vehicle '{vehicleId}' not found");

        vehicle.LastMileage = lastMileage;
        await _db.SaveChangesAsync();
        return ToDto(vehicle);
    }

    private static VehicleDto ToDto(Vehicle v) => new()
    {
        Id = v.Id,
        CompanyId = v.CompanyId,
        SectorId = v.SectorId,
        Model = v.Model,
        IsTruck = v.IsTruck,
        Status = v.Status.ToString(),
        LastMileage = v.LastMileage,
        ImageUrl = v.ImageUrl
    };
}
