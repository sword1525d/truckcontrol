using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Frotacontrol.Api.Hubs;

[Authorize]
public class RunsHub : Hub
{
    // Groups by company/sector for admin dashboard
    public async Task SubscribeToSector(string companyId, string sectorId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"{companyId}/{sectorId}");
    }

    public async Task UnsubscribeFromSector(string companyId, string sectorId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"{companyId}/{sectorId}");
    }

    // Subscribe to a specific run for real-time GPS + stop updates
    public async Task SubscribeToRun(Guid runId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"run:{runId}");
    }

    public async Task UnsubscribeFromRun(Guid runId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"run:{runId}");
    }
}
