using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Frotacontrol.Core.DTOs.Checklists;
using Frotacontrol.Core.Interfaces;

namespace Frotacontrol.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/companies/{companyId}/sectors/{sectorId}/vehicles/{vehicleId}/checklists")]
public class ChecklistsController : ControllerBase
{
    private readonly IChecklistService _service;

    public ChecklistsController(IChecklistService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<List<ChecklistDto>>> GetHistory(
        string companyId, string sectorId, string vehicleId,
        [FromQuery] DateTimeOffset? dateFrom = null,
        [FromQuery] DateTimeOffset? dateTo = null)
    {
        return Ok(await _service.GetHistoryAsync(companyId, sectorId, vehicleId, dateFrom, dateTo));
    }

    [HttpGet("today")]
    public async Task<ActionResult<ChecklistDto>> GetToday(string companyId, string sectorId, string vehicleId)
    {
        var checklist = await _service.GetTodayAsync(companyId, sectorId, vehicleId);
        if (checklist == null) return NotFound();
        return Ok(checklist);
    }

    [HttpPost]
    public async Task<ActionResult<ChecklistDto>> Submit(string companyId, string sectorId, string vehicleId, [FromBody] SubmitChecklistRequest request)
    {
        var checklist = await _service.SubmitAsync(companyId, sectorId, vehicleId, request, async () =>
        {
            // Email notification placeholder — will be wired in Phase 7 (Managers + Email)
            Console.WriteLine($"[Checklist] Non-conformance blocked vehicle {vehicleId} in {companyId}/{sectorId}");
            await Task.CompletedTask;
        });

        return Ok(checklist);
    }
}
