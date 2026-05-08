using Frotacontrol.Core.DTOs.Refuels;

namespace Frotacontrol.Core.Interfaces;

public interface IRefuelService
{
    Task<List<RefuelDto>> GetRefuelsAsync(string companyId, string sectorId, string? vehicleId = null, DateTimeOffset? dateFrom = null, DateTimeOffset? dateTo = null);
    Task<RefuelDto> CreateRefuelAsync(string companyId, string sectorId, CreateRefuelRequest request);
}
