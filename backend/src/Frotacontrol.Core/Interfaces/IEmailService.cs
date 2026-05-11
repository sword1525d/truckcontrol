using Frotacontrol.Core.DTOs.Email;

namespace Frotacontrol.Core.Interfaces;

public interface IEmailService
{
    Task SendChecklistNonConformanceAsync(
        string driverName, string vehicleId,
        List<ChecklistNonConformanceItem> items,
        List<string> managerEmails, DateTimeOffset date, bool isBlocked);

    Task SendVehicleUnblockedAsync(
        string vehicleId, string adminName,
        List<string> managerEmails, DateTimeOffset date);
}
