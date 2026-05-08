using Frotacontrol.Core.DTOs.FuelCards;

namespace Frotacontrol.Core.Interfaces;

public interface IFuelCardService
{
    Task<FuelCardDto?> GetByVehicleAsync(string vehicleId);
    Task<FuelCardDto> CreateAsync(string companyId, string sectorId, CreateFuelCardRequest request);
    Task<FuelCardRechargeDto> RechargeAsync(string vehicleId, RechargeFuelCardRequest request);
}
