using Frotacontrol.Core.DTOs.Auth;

namespace Frotacontrol.Core.Interfaces;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task<LoginResponse> RefreshTokenAsync(string refreshToken);
    Task LogoutAsync(string userId);
}
