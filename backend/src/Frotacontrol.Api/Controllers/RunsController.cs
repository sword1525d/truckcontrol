using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Frotacontrol.Api.Hubs;
using Frotacontrol.Core.DTOs.Runs;
using Frotacontrol.Core.Interfaces;

namespace Frotacontrol.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/companies/{companyId}/sectors/{sectorId}/runs")]
public class RunsController : ControllerBase
{
    private readonly IRunService _service;
    private readonly IHubContext<RunsHub> _hub;

    public RunsController(IRunService service, IHubContext<RunsHub> hub)
    {
        _service = service;
        _hub = hub;
    }

    [HttpGet]
    public async Task<ActionResult<List<RunSummaryDto>>> GetRuns(
        string companyId, string sectorId,
        [FromQuery] string? status = null,
        [FromQuery] string? driverId = null,
        [FromQuery] string? vehicleId = null,
        [FromQuery] DateTimeOffset? dateFrom = null,
        [FromQuery] DateTimeOffset? dateTo = null)
    {
        return Ok(await _service.GetRunsAsync(companyId, sectorId, status, driverId, vehicleId, dateFrom, dateTo));
    }

    [HttpGet("active")]
    public async Task<ActionResult<List<RunSummaryDto>>> GetActiveRuns(string companyId, string sectorId, [FromQuery] string? vehicleId = null)
    {
        return Ok(await _service.GetActiveRunsAsync(companyId, sectorId, vehicleId));
    }

    [HttpGet("{runId:guid}")]
    public async Task<ActionResult<RunDto>> GetRun(string companyId, string sectorId, Guid runId)
    {
        var run = await _service.GetRunAsync(companyId, sectorId, runId);
        if (run == null) return NotFound();
        return Ok(run);
    }

    [HttpPost]
    public async Task<ActionResult<RunDto>> Create(string companyId, string sectorId, [FromBody] CreateRunRequest request)
    {
        var run = await _service.CreateRunAsync(companyId, sectorId, request);

        // Notify admin dashboard
        await _hub.Clients.Group($"{companyId}/{sectorId}").SendAsync("RunStarted", new
        {
            run.Id, run.VehicleId, run.DriverName, run.StartMileage, run.StartTime, run.RouteId, run.TripName
        });

        return Ok(run);
    }

    [HttpPut("{runId:guid}/stops/{stopIndex:int}/arrival")]
    public async Task<ActionResult<RunDto>> StopArrival(string companyId, string sectorId, Guid runId, int stopIndex, [FromBody] UpdateStopArrivalRequest? request)
    {
        var run = await _service.UpdateStopArrivalAsync(companyId, sectorId, runId, stopIndex, request ?? new UpdateStopArrivalRequest());

        await _hub.Clients.Group($"run:{runId}").SendAsync("StopUpdated", run.Stops);
        await _hub.Clients.Group($"{companyId}/{sectorId}").SendAsync("RunUpdated", new
        {
            run.Id, run.Status, CompletedStops = run.Stops.Count(s => s.Status == "COMPLETED"),
            TotalStops = run.Stops.Count
        });

        return Ok(run);
    }

    [HttpPut("{runId:guid}/stops/{stopIndex:int}/departure")]
    public async Task<ActionResult<RunDto>> StopDeparture(string companyId, string sectorId, Guid runId, int stopIndex, [FromBody] UpdateStopDepartureRequest request)
    {
        var run = await _service.UpdateStopDepartureAsync(companyId, sectorId, runId, stopIndex, request);

        await _hub.Clients.Group($"run:{runId}").SendAsync("StopUpdated", run.Stops);
        await _hub.Clients.Group($"{companyId}/{sectorId}").SendAsync("RunUpdated", new
        {
            run.Id, run.Status, CompletedStops = run.Stops.Count(s => s.Status == "COMPLETED"),
            TotalStops = run.Stops.Count
        });

        return Ok(run);
    }

    [HttpPut("{runId:guid}/end")]
    public async Task<ActionResult<RunDto>> EndRun(string companyId, string sectorId, Guid runId)
    {
        var run = await _service.EndRunAsync(companyId, sectorId, runId);

        await _hub.Clients.Group($"run:{runId}").SendAsync("RunEnded", new { run.Id, run.EndMileage, run.EndTime });
        await _hub.Clients.Group($"{companyId}/{sectorId}").SendAsync("RunUpdated", new
        {
            run.Id,
            Status = "COMPLETED",
            run.EndMileage,
            run.EndTime
        });

        return Ok(run);
    }

    [HttpPut("{runId:guid}/cancel")]
    public async Task<ActionResult<RunDto>> CancelRun(string companyId, string sectorId, Guid runId)
    {
        var run = await _service.CancelRunAsync(companyId, sectorId, runId);

        await _hub.Clients.Group($"run:{runId}").SendAsync("RunCanceled", new { run.Id });
        await _hub.Clients.Group($"{companyId}/{sectorId}").SendAsync("RunUpdated", new { run.Id, Status = "CANCELED" });

        return Ok(run);
    }

    [HttpPost("{runId:guid}/location")]
    public async Task<IActionResult> AddLocation(string companyId, string sectorId, Guid runId, [FromBody] GpsLocationRequest request)
    {
        await _service.AddLocationBatchAsync(companyId, sectorId, runId, request);

        // Broadcast latest location to subscribed clients
        var latest = request.Locations.LastOrDefault();
        if (latest != null)
        {
            await _hub.Clients.Group($"run:{runId}").SendAsync("LocationUpdated", latest);
            await _hub.Clients.Group($"{companyId}/{sectorId}").SendAsync("VehicleLocation", new
            {
                RunId = runId,
                latest.Latitude,
                latest.Longitude,
                latest.Timestamp
            });
        }

        return Ok();
    }

    [HttpPut("{runId:guid}/takeover")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<RunDto>> Takeover(string companyId, string sectorId, Guid runId, [FromBody] TakeoverRequest request)
    {
        var run = await _service.TakeoverRunAsync(companyId, sectorId, runId, request);

        await _hub.Clients.Group($"run:{runId}").SendAsync("RunUpdated", new { run.Id, run.DriverName });
        await _hub.Clients.Group($"{companyId}/{sectorId}").SendAsync("RunUpdated", new { run.Id, run.DriverName });

        return Ok(run);
    }
}
