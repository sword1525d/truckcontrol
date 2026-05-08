using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Frotacontrol.Core.DTOs.Routes;
using Frotacontrol.Core.DTOs.StopPoints;
using Frotacontrol.Core.Interfaces;

namespace Frotacontrol.Api.Controllers;

[ApiController]
[Authorize]
public class RoutesController : ControllerBase
{
    private readonly IRouteService _service;

    public RoutesController(IRouteService service)
    {
        _service = service;
    }

    // ---- Routes ----

    [HttpGet("api/companies/{companyId}/sectors/{sectorId}/routes")]
    public async Task<ActionResult<List<RouteDto>>> GetRoutes(
        string companyId, string sectorId,
        [FromQuery] string? date = null,
        [FromQuery] int? shift = null,
        [FromQuery] string? vehicleId = null)
    {
        return Ok(await _service.GetRoutesAsync(companyId, sectorId, date, shift, vehicleId));
    }

    [HttpGet("api/companies/{companyId}/sectors/{sectorId}/routes/{routeId:guid}")]
    public async Task<ActionResult<RouteDto>> GetRoute(string companyId, string sectorId, Guid routeId)
    {
        var route = await _service.GetRouteAsync(companyId, sectorId, routeId);
        if (route == null) return NotFound();
        return Ok(route);
    }

    [HttpPost("api/companies/{companyId}/sectors/{sectorId}/routes")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<RouteDto>> Create(string companyId, string sectorId, [FromBody] CreateRouteRequest request)
    {
        return Ok(await _service.CreateRouteAsync(companyId, sectorId, request));
    }

    [HttpPut("api/companies/{companyId}/sectors/{sectorId}/routes/{routeId:guid}")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<RouteDto>> Update(string companyId, string sectorId, Guid routeId, [FromBody] UpdateRouteRequest request)
    {
        return Ok(await _service.UpdateRouteAsync(companyId, sectorId, routeId, request));
    }

    [HttpDelete("api/companies/{companyId}/sectors/{sectorId}/routes/{routeId:guid}")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<IActionResult> Delete(string companyId, string sectorId, Guid routeId)
    {
        await _service.DeleteRouteAsync(companyId, sectorId, routeId);
        return Ok();
    }

    // ---- Stop Points (scoped by company + sector) ----

    [HttpGet("api/companies/{companyId}/sectors/{sectorId}/stop-points")]
    public async Task<ActionResult<List<StopPointDto>>> GetStopPoints(string companyId, string sectorId)
    {
        return Ok(await _service.GetStopPointsAsync(companyId, sectorId));
    }

    [HttpPost("api/companies/{companyId}/sectors/{sectorId}/stop-points")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<StopPointDto>> CreateStopPoint(string companyId, string sectorId, [FromBody] CreateStopPointRequest request)
    {
        return Ok(await _service.CreateStopPointAsync(companyId, sectorId, request));
    }

    [HttpPut("api/companies/{companyId}/sectors/{sectorId}/stop-points/{id:int}")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<StopPointDto>> UpdateStopPoint(string companyId, string sectorId, int id, [FromBody] UpdateStopPointRequest request)
    {
        return Ok(await _service.UpdateStopPointAsync(companyId, sectorId, id, request));
    }

    [HttpDelete("api/companies/{companyId}/sectors/{sectorId}/stop-points/{id:int}")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<IActionResult> DeleteStopPoint(string companyId, string sectorId, int id)
    {
        await _service.DeleteStopPointAsync(companyId, sectorId, id);
        return Ok();
    }
}
