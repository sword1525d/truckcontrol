using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Frotacontrol.Core.DTOs.Refuels;
using Frotacontrol.Core.Interfaces;

namespace Frotacontrol.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/companies/{companyId}/sectors/{sectorId}/refuels")]
public class RefuelsController : ControllerBase
{
    private readonly IRefuelService _service;

    public RefuelsController(IRefuelService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<List<RefuelDto>>> GetRefuels(
        string companyId, string sectorId,
        [FromQuery] string? vehicleId = null,
        [FromQuery] DateTimeOffset? dateFrom = null,
        [FromQuery] DateTimeOffset? dateTo = null)
    {
        return Ok(await _service.GetRefuelsAsync(companyId, sectorId, vehicleId, dateFrom, dateTo));
    }

    [HttpPost]
    public async Task<ActionResult<RefuelDto>> Create(string companyId, string sectorId, [FromBody] CreateRefuelRequest request)
    {
        return Ok(await _service.CreateRefuelAsync(companyId, sectorId, request));
    }
}
