using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Frotacontrol.Core.DTOs.FuelCards;
using Frotacontrol.Core.Interfaces;

namespace Frotacontrol.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/companies/{companyId}/sectors/{sectorId}/fuel-cards")]
public class FuelCardsController : ControllerBase
{
    private readonly IFuelCardService _service;

    public FuelCardsController(IFuelCardService service)
    {
        _service = service;
    }

    [HttpGet("{vehicleId}")]
    public async Task<ActionResult<FuelCardDto>> GetByVehicle(string companyId, string sectorId, string vehicleId)
    {
        var card = await _service.GetByVehicleAsync(vehicleId);
        if (card == null) return NotFound();
        return Ok(card);
    }

    [HttpPost]
    public async Task<ActionResult<FuelCardDto>> Create(string companyId, string sectorId, [FromBody] CreateFuelCardRequest request)
    {
        return Ok(await _service.CreateAsync(companyId, sectorId, request));
    }

    [HttpPost("{vehicleId}/recharge")]
    public async Task<ActionResult<FuelCardRechargeDto>> Recharge(string companyId, string sectorId, string vehicleId, [FromBody] RechargeFuelCardRequest request)
    {
        return Ok(await _service.RechargeAsync(vehicleId, request));
    }
}
