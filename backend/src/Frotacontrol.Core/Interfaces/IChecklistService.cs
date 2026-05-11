using Frotacontrol.Core.DTOs.Checklists;

namespace Frotacontrol.Core.Interfaces;

public interface IChecklistService
{
    Task<List<ChecklistDto>> GetHistoryAsync(string companyId, string sectorId, string vehicleId, DateTimeOffset? dateFrom = null, DateTimeOffset? dateTo = null);
    Task<ChecklistDto?> GetTodayAsync(string companyId, string sectorId, string vehicleId);
    Task<ChecklistDto> SubmitAsync(string companyId, string sectorId, string vehicleId, SubmitChecklistRequest request, Func<Task>? onBlockNotification = null);
    Task DeleteAsync(string companyId, string sectorId, string vehicleId, Guid checklistId);
}
