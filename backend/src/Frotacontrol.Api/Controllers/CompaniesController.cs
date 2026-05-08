using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Frotacontrol.Core.DTOs.Companies;
using Frotacontrol.Core.Interfaces;

namespace Frotacontrol.Api.Controllers;

[ApiController]
[Authorize]
public class CompaniesController : ControllerBase
{
    private readonly ICompanyService _service;

    public CompaniesController(ICompanyService service)
    {
        _service = service;
    }

    [HttpGet("api/companies")]
    [AllowAnonymous]
    public async Task<ActionResult<List<CompanyDto>>> GetAll()
    {
        return Ok(await _service.GetAllAsync());
    }

    [HttpPost("api/companies")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<CompanyDto>> Create([FromBody] CreateCompanyRequest request)
    {
        return Ok(await _service.CreateAsync(request));
    }

    [HttpDelete("api/companies/{id}")]
    [Authorize(Roles = "OP")]
    public async Task<IActionResult> Delete(string id)
    {
        await _service.DeleteAsync(id);
        return Ok();
    }

    [HttpGet("api/companies/{companyId}/sectors")]
    [AllowAnonymous]
    public async Task<ActionResult<List<SectorDto>>> GetSectors(string companyId)
    {
        return Ok(await _service.GetSectorsAsync(companyId));
    }

    [HttpPost("api/companies/{companyId}/sectors")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<SectorDto>> CreateSector(string companyId, [FromBody] CreateSectorRequest request)
    {
        return Ok(await _service.CreateSectorAsync(companyId, request));
    }

    [HttpDelete("api/companies/{companyId}/sectors/{sectorId}")]
    [Authorize(Roles = "OP")]
    public async Task<IActionResult> DeleteSector(string companyId, string sectorId)
    {
        await _service.DeleteSectorAsync(companyId, sectorId);
        return Ok();
    }

    [HttpGet("api/companies/{companyId}/groups")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<List<GroupDto>>> GetGroups(string companyId)
    {
        return Ok(await _service.GetGroupsAsync(companyId));
    }

    [HttpPost("api/companies/{companyId}/groups")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<GroupDto>> CreateGroup(string companyId, [FromBody] CreateGroupRequest request)
    {
        return Ok(await _service.CreateGroupAsync(companyId, request));
    }

    [HttpDelete("api/companies/{companyId}/groups/{groupId}")]
    [Authorize(Roles = "OP")]
    public async Task<IActionResult> DeleteGroup(string companyId, string groupId)
    {
        await _service.DeleteGroupAsync(companyId, groupId);
        return Ok();
    }

    [HttpPost("api/companies/{companyId}/sectors/{sectorId}/group")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<IActionResult> AssignSectorToGroup(string companyId, string sectorId, [FromBody] AssignSectorToGroupRequest request)
    {
        await _service.AssignSectorToGroupAsync(companyId, sectorId, request.GroupId);
        return Ok();
    }

    [HttpDelete("api/companies/{companyId}/sectors/{sectorId}/group")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<IActionResult> RemoveSectorFromGroup(string companyId, string sectorId)
    {
        await _service.RemoveSectorFromGroupAsync(companyId, sectorId);
        return Ok();
    }
}
