using Frotacontrol.Core.DTOs.Maintenance;

namespace Frotacontrol.Core.Interfaces;

public interface IMaintenanceService
{
    Task<List<MaintenanceRecordDto>> GetHistoryAsync(string companyId, string sectorId, string vehicleId);
    Task<MaintenanceRecordDto> StartAsync(string companyId, string sectorId, string vehicleId, string? notes);
    Task<MaintenanceRecordDto> EndAsync(string companyId, string sectorId, string vehicleId);
}
