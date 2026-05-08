using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Frotacontrol.Core.DTOs.Managers;
using Frotacontrol.Core.Interfaces;

namespace Frotacontrol.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/companies/{companyId}/sectors/{sectorId}/managers")]
public class ManagersController : ControllerBase
{
    private readonly IManagerService _service;

    public ManagersController(IManagerService service)
    {
        _service = service;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<List<ManagerDto>>> GetManagers(string companyId, string sectorId)
    {
        return Ok(await _service.GetManagersAsync(companyId, sectorId));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<ManagerDto>> Create(string companyId, string sectorId, [FromBody] CreateManagerRequest request)
    {
        return Ok(await _service.CreateManagerAsync(companyId, sectorId, request));
    }

    [HttpDelete("{managerId:guid}")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<IActionResult> Delete(string companyId, string sectorId, Guid managerId)
    {
        await _service.DeleteManagerAsync(companyId, sectorId, managerId);
        return Ok();
    }
}
