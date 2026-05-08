using Frotacontrol.Core.DTOs.Runs;

namespace Frotacontrol.Core.Interfaces;

public interface IRunService
{
    Task<List<RunSummaryDto>> GetRunsAsync(string companyId, string sectorId, string? status = null, string? driverId = null, string? vehicleId = null, DateTimeOffset? dateFrom = null, DateTimeOffset? dateTo = null);
    Task<List<RunSummaryDto>> GetActiveRunsAsync(string companyId, string sectorId, string? vehicleId = null);
    Task<RunDto?> GetRunAsync(string companyId, string sectorId, Guid runId);
    Task<RunDto> CreateRunAsync(string companyId, string sectorId, CreateRunRequest request);
    Task<RunDto> UpdateStopArrivalAsync(string companyId, string sectorId, Guid runId, int stopIndex, UpdateStopArrivalRequest request);
    Task<RunDto> UpdateStopDepartureAsync(string companyId, string sectorId, Guid runId, int stopIndex, UpdateStopDepartureRequest request);
    Task<RunDto> EndRunAsync(string companyId, string sectorId, Guid runId);
    Task<RunDto> CancelRunAsync(string companyId, string sectorId, Guid runId);
    Task AddLocationBatchAsync(string companyId, string sectorId, Guid runId, GpsLocationRequest request);
    Task<RunDto> TakeoverRunAsync(string companyId, string sectorId, Guid runId, TakeoverRequest request);
}
