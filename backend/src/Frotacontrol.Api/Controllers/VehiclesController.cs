using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Frotacontrol.Core.DTOs.Maintenance;
using Frotacontrol.Core.DTOs.Vehicles;
using Frotacontrol.Core.Interfaces;

namespace Frotacontrol.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/companies/{companyId}/sectors/{sectorId}/vehicles")]
public class VehiclesController : ControllerBase
{
    private readonly IVehicleService _vehicleService;
    private readonly IMaintenanceService _maintenanceService;
    private readonly IManagerService _managerService;
    private readonly IEmailService _emailService;

    public VehiclesController(IVehicleService vehicleService, IMaintenanceService maintenanceService, IManagerService managerService, IEmailService emailService)
    {
        _vehicleService = vehicleService;
        _maintenanceService = maintenanceService;
        _managerService = managerService;
        _emailService = emailService;
    }

    [HttpGet]
    public async Task<ActionResult<List<VehicleDto>>> GetVehicles(string companyId, string sectorId, [FromQuery] bool? isTruck = null)
    {
        return Ok(await _vehicleService.GetVehiclesAsync(companyId, sectorId, isTruck));
    }

    [HttpGet("{vehicleId}")]
    public async Task<ActionResult<VehicleDto>> GetVehicle(string companyId, string sectorId, string vehicleId)
    {
        var vehicle = await _vehicleService.GetVehicleAsync(companyId, sectorId, vehicleId);
        if (vehicle == null) return NotFound();
        return Ok(vehicle);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<VehicleDto>> Create(string companyId, string sectorId, [FromBody] CreateVehicleRequest request)
    {
        return Ok(await _vehicleService.CreateVehicleAsync(companyId, sectorId, request));
    }

    [HttpPut("{vehicleId}")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<VehicleDto>> Update(string companyId, string sectorId, string vehicleId, [FromBody] UpdateVehicleRequest request)
    {
        return Ok(await _vehicleService.UpdateVehicleAsync(companyId, sectorId, vehicleId, request));
    }

    [HttpDelete("{vehicleId}")]
    [Authorize(Roles = "OP")]
    public async Task<IActionResult> Delete(string companyId, string sectorId, string vehicleId)
    {
        await _vehicleService.DeleteVehicleAsync(companyId, sectorId, vehicleId);
        return Ok();
    }

    [HttpPut("{vehicleId}/status")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<VehicleDto>> UpdateStatus(string companyId, string sectorId, string vehicleId, [FromBody] UpdateVehicleStatusRequest request)
    {
        var oldVehicle = await _vehicleService.GetVehicleAsync(companyId, sectorId, vehicleId);
        var oldStatus = oldVehicle?.Status;

        var result = await _vehicleService.UpdateStatusAsync(companyId, sectorId, vehicleId, request);

        if (oldStatus == "BLOQUEADO_CHECKLIST" && request.Status == "PARADO")
        {
            try
            {
                var managers = await _managerService.GetManagersAsync(companyId, sectorId);
                var managerEmails = managers.Select(m => m.Email).ToList();
                if (managerEmails.Count > 0)
                {
                    var adminName = User.FindFirstValue(ClaimTypes.Name) ?? "Admin";
                    await _emailService.SendVehicleUnblockedAsync(vehicleId, adminName, managerEmails, DateTimeOffset.UtcNow);
                }
            }
            catch
            {
                // Email failure should not break the status update
            }
        }

        return Ok(result);
    }

    [HttpPatch("{vehicleId}/last-mileage")]
    public async Task<ActionResult<VehicleDto>> UpdateMileage(string companyId, string sectorId, string vehicleId, [FromBody] UpdateVehicleMileageRequest request)
    {
        return Ok(await _vehicleService.UpdateMileageAsync(companyId, sectorId, vehicleId, request.LastMileage));
    }

    // ---- Maintenance ----

    [HttpGet("{vehicleId}/maintenance")]
    public async Task<ActionResult<List<MaintenanceRecordDto>>> GetMaintenanceHistory(string companyId, string sectorId, string vehicleId)
    {
        return Ok(await _maintenanceService.GetHistoryAsync(companyId, sectorId, vehicleId));
    }

    [HttpPost("{vehicleId}/maintenance/start")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<MaintenanceRecordDto>> StartMaintenance(string companyId, string sectorId, string vehicleId, [FromBody] StartMaintenanceRequest? request)
    {
        return Ok(await _maintenanceService.StartAsync(companyId, sectorId, vehicleId, request?.Notes));
    }

    [HttpPost("{vehicleId}/maintenance/end")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<MaintenanceRecordDto>> EndMaintenance(string companyId, string sectorId, string vehicleId)
    {
        return Ok(await _maintenanceService.EndAsync(companyId, sectorId, vehicleId));
    }
}
