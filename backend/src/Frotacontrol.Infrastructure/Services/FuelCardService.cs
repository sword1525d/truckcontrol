using Microsoft.EntityFrameworkCore;
using Frotacontrol.Core.DTOs.FuelCards;
using Frotacontrol.Core.Entities;
using Frotacontrol.Core.Interfaces;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Infrastructure.Services;

public class FuelCardService : IFuelCardService
{
    private readonly AppDbContext _db;

    public FuelCardService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<FuelCardDto?> GetByVehicleAsync(string vehicleId)
    {
        var card = await _db.FuelCards
            .Include(fc => fc.Recharges)
            .FirstOrDefaultAsync(fc => fc.VehicleId == vehicleId);

        if (card == null) return null;

        return new FuelCardDto
        {
            VehicleId = card.VehicleId,
            CompanyId = card.CompanyId,
            SectorId = card.SectorId,
            Balance = card.Balance,
            Recharges = card.Recharges.OrderByDescending(r => r.Date).ThenByDescending(r => r.Time).Select(r => new FuelCardRechargeDto
            {
                Id = r.Id,
                FuelCardVehicleId = r.FuelCardVehicleId,
                Amount = r.Amount,
                Date = r.Date,
                Time = r.Time,
                Responsible = r.Responsible
            }).ToList()
        };
    }

    public async Task<FuelCardDto> CreateAsync(string companyId, string sectorId, CreateFuelCardRequest request)
    {
        var card = new FuelCard
        {
            VehicleId = request.VehicleId,
            CompanyId = companyId,
            SectorId = sectorId,
            Balance = request.InitialBalance
        };

        _db.FuelCards.Add(card);
        await _db.SaveChangesAsync();

        return new FuelCardDto
        {
            VehicleId = card.VehicleId,
            CompanyId = card.CompanyId,
            SectorId = card.SectorId,
            Balance = card.Balance,
            Recharges = new()
        };
    }

    public async Task<FuelCardRechargeDto> RechargeAsync(string vehicleId, RechargeFuelCardRequest request)
    {
        var card = await _db.FuelCards.FirstOrDefaultAsync(fc => fc.VehicleId == vehicleId)
            ?? throw new KeyNotFoundException($"Fuel card for vehicle '{vehicleId}' not found");

        var now = DateTime.Now;
        var recharge = new FuelCardRecharge
        {
            Id = Guid.NewGuid(),
            FuelCardVehicleId = vehicleId,
            Amount = request.Amount,
            Date = now.Date,
            Time = now.TimeOfDay,
            Responsible = request.Responsible
        };

        card.Balance += request.Amount;

        _db.FuelCardRecharges.Add(recharge);
        await _db.SaveChangesAsync();

        return new FuelCardRechargeDto
        {
            Id = recharge.Id,
            FuelCardVehicleId = recharge.FuelCardVehicleId,
            Amount = recharge.Amount,
            Date = recharge.Date,
            Time = recharge.Time,
            Responsible = recharge.Responsible
        };
    }
}
