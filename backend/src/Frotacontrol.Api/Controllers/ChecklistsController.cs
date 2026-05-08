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
    private readonly IChecklistService _checklistService;
    private readonly IManagerService _managerService;
    private readonly IEmailService _emailService;

    public ChecklistsController(IChecklistService checklistService, IManagerService managerService, IEmailService emailService)
    {
        _checklistService = checklistService;
        _managerService = managerService;
        _emailService = emailService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ChecklistDto>>> GetHistory(
        string companyId, string sectorId, string vehicleId,
        [FromQuery] DateTimeOffset? dateFrom = null,
        [FromQuery] DateTimeOffset? dateTo = null)
    {
        return Ok(await _checklistService.GetHistoryAsync(companyId, sectorId, vehicleId, dateFrom, dateTo));
    }

    [HttpGet("today")]
    public async Task<ActionResult<ChecklistDto>> GetToday(string companyId, string sectorId, string vehicleId)
    {
        var checklist = await _checklistService.GetTodayAsync(companyId, sectorId, vehicleId);
        if (checklist == null) return NotFound();
        return Ok(checklist);
    }

    [HttpPost]
    public async Task<ActionResult<ChecklistDto>> Submit(string companyId, string sectorId, string vehicleId, [FromBody] SubmitChecklistRequest request)
    {
        ChecklistDto checklist;

        try
        {
            // Load managers once for potential notification
            var managers = await _managerService.GetManagersAsync(companyId, sectorId);
            var managerEmails = managers.Select(m => m.Email).ToList();

            checklist = await _checklistService.SubmitAsync(companyId, sectorId, vehicleId, request, async () =>
            {
                if (managerEmails.Count > 0)
                {
                    var ncItems = request.Items
                        .Where(i => i.Status == "nao_conforme")
                        .Select(i => $"{i.Title} (Grau {i.Location})")
                        .ToList();

                    var isBlocked = request.Items.Any(i =>
                        (i.Location == "A" || i.Location == "B") && i.Status == "nao_conforme");

                    await _emailService.SendChecklistNonConformanceAsync(
                        request.DriverName,
                        vehicleId,
                        ncItems,
                        managerEmails,
                        DateTimeOffset.UtcNow,
                        isBlocked
                    );
                }
            });
        }
        catch (Exception)
        {
            // Email failure should not break the checklist submission
            checklist = await _checklistService.SubmitAsync(companyId, sectorId, vehicleId, request);
        }

        return Ok(checklist);
    }
}
