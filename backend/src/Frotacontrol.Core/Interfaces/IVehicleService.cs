using Frotacontrol.Core.DTOs.Vehicles;

namespace Frotacontrol.Core.Interfaces;

public interface IVehicleService
{
    Task<List<VehicleDto>> GetVehiclesAsync(string companyId, string sectorId, bool? isTruck = null);
    Task<VehicleDto?> GetVehicleAsync(string companyId, string sectorId, string vehicleId);
    Task<VehicleDto> CreateVehicleAsync(string companyId, string sectorId, CreateVehicleRequest request);
    Task<VehicleDto> UpdateVehicleAsync(string companyId, string sectorId, string vehicleId, UpdateVehicleRequest request);
    Task DeleteVehicleAsync(string companyId, string sectorId, string vehicleId);
    Task<VehicleDto> UpdateStatusAsync(string companyId, string sectorId, string vehicleId, UpdateVehicleStatusRequest request);
    Task<VehicleDto> UpdateMileageAsync(string companyId, string sectorId, string vehicleId, decimal lastMileage);
}
