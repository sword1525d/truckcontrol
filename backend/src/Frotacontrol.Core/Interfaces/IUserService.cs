using Frotacontrol.Core.DTOs.Users;

namespace Frotacontrol.Core.Interfaces;

public interface IUserService
{
    Task<List<UserDto>> GetUsersAsync(string companyId, string sectorId);
    Task<UserDto?> GetUserAsync(string companyId, string sectorId, string userId);
    Task<UserDto> CreateUserAsync(string companyId, string sectorId, CreateUserRequest request);
    Task<UserDto> UpdateUserAsync(string companyId, string sectorId, string userId, UpdateUserRequest request);
    Task DeleteUserAsync(string companyId, string sectorId, string userId);
    Task<UserDto?> GetMyProfileAsync(string userId);
}
