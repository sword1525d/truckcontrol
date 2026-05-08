using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Frotacontrol.Core.DTOs.Users;
using Frotacontrol.Core.Interfaces;

namespace Frotacontrol.Api.Controllers;

[ApiController]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _service;

    public UsersController(IUserService service)
    {
        _service = service;
    }

    [HttpGet("api/me/profile")]
    public async Task<ActionResult<UserDto>> GetMyProfile()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _service.GetMyProfileAsync(userId);
        if (user == null) return NotFound();
        return Ok(user);
    }

    [HttpGet("api/companies/{companyId}/sectors/{sectorId}/users")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<List<UserDto>>> GetUsers(string companyId, string sectorId)
    {
        return Ok(await _service.GetUsersAsync(companyId, sectorId));
    }

    [HttpGet("api/companies/{companyId}/sectors/{sectorId}/users/{userId}")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<UserDto>> GetUser(string companyId, string sectorId, string userId)
    {
        var user = await _service.GetUserAsync(companyId, sectorId, userId);
        if (user == null) return NotFound();
        return Ok(user);
    }

    [HttpPost("api/companies/{companyId}/sectors/{sectorId}/users")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<UserDto>> CreateUser(string companyId, string sectorId, [FromBody] CreateUserRequest request)
    {
        return Ok(await _service.CreateUserAsync(companyId, sectorId, request));
    }

    [HttpPut("api/companies/{companyId}/sectors/{sectorId}/users/{userId}")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<ActionResult<UserDto>> UpdateUser(string companyId, string sectorId, string userId, [FromBody] UpdateUserRequest request)
    {
        return Ok(await _service.UpdateUserAsync(companyId, sectorId, userId, request));
    }

    [HttpDelete("api/companies/{companyId}/sectors/{sectorId}/users/{userId}")]
    [Authorize(Roles = "Admin,OP")]
    public async Task<IActionResult> DeleteUser(string companyId, string sectorId, string userId)
    {
        await _service.DeleteUserAsync(companyId, sectorId, userId);
        return Ok();
    }
}
