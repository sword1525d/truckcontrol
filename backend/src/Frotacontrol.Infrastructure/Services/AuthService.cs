using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Frotacontrol.Core.DTOs.Auth;
using Frotacontrol.Core.Entities;
using Frotacontrol.Core.Interfaces;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(UserManager<IdentityUser> userManager, AppDbContext db, IConfiguration config)
    {
        _userManager = userManager;
        _db = db;
        _config = config;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        IdentityUser identityUser;

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            identityUser = await _userManager.FindByEmailAsync(request.Email)
                ?? throw new UnauthorizedAccessException("Invalid credentials");

            if (!await _userManager.CheckPasswordAsync(identityUser, request.Password))
                throw new UnauthorizedAccessException("Invalid credentials");
        }
        else if (!string.IsNullOrWhiteSpace(request.Matricula))
        {
            if (string.IsNullOrWhiteSpace(request.CompanyId) || string.IsNullOrWhiteSpace(request.SectorId))
                throw new UnauthorizedAccessException("CompanyId and SectorId are required for matricula login");

            var email = $"{request.Matricula}@frotacontrol.com";
            identityUser = await _userManager.FindByEmailAsync(email)
                ?? throw new UnauthorizedAccessException("Invalid credentials");

            if (!await _userManager.CheckPasswordAsync(identityUser, request.Password))
                throw new UnauthorizedAccessException("Invalid credentials");
        }
        else
        {
            throw new UnauthorizedAccessException("Email or Matricula is required");
        }

        var user = await ResolveUserProfile(identityUser.Id, request.CompanyId, request.SectorId);
        var profile = await BuildProfile(user, request.CompanyId, request.SectorId);
        var (token, refreshToken) = GenerateTokens(identityUser, profile);

        user.RefreshTokenHash = HashToken(refreshToken);
        user.RefreshTokenExpiry = DateTimeOffset.UtcNow.AddDays(7);
        await _db.SaveChangesAsync();

        return new LoginResponse { Token = token, RefreshToken = refreshToken, Profile = profile };
    }

    public async Task<LoginResponse> RefreshTokenAsync(string refreshToken)
    {
        var hash = HashToken(refreshToken);
        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.RefreshTokenHash == hash && u.RefreshTokenExpiry > DateTimeOffset.UtcNow);

        if (user == null)
            throw new UnauthorizedAccessException("Invalid or expired refresh token");

        var identityUser = await _userManager.FindByIdAsync(user.Id);
        if (identityUser == null)
            throw new UnauthorizedAccessException("User not found");

        var profile = await BuildProfile(user, null, null);
        var (token, newRefreshToken) = GenerateTokens(identityUser, profile);

        user.RefreshTokenHash = HashToken(newRefreshToken);
        user.RefreshTokenExpiry = DateTimeOffset.UtcNow.AddDays(7);
        await _db.SaveChangesAsync();

        return new LoginResponse { Token = token, RefreshToken = newRefreshToken, Profile = profile };
    }

    public async Task LogoutAsync(string userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user != null)
        {
            user.RefreshTokenHash = null;
            user.RefreshTokenExpiry = null;
            await _db.SaveChangesAsync();
        }
    }

    private async Task<User> ResolveUserProfile(string identityId, string? companyId, string? sectorId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == identityId);
        if (user == null)
            throw new UnauthorizedAccessException("User profile not found");

        // Email login without company/sector: return first profile found
        if (string.IsNullOrWhiteSpace(companyId) || string.IsNullOrWhiteSpace(sectorId))
            return user;

        if (user.CompanyId == companyId && user.SectorId == sectorId)
            return user;

        // Fallback: try the specified company/sector
        var fallback = await _db.Users.FirstOrDefaultAsync(u =>
            u.Id == identityId && u.CompanyId == companyId && u.SectorId == sectorId);

        if (fallback != null)
            return fallback;

        // Allow admins and OPs to log in from any sector
        if (!user.IsAdmin && !user.IsOP)
            throw new UnauthorizedAccessException("User does not belong to this company/sector");

        return user;
    }

    private async Task<UserProfile> BuildProfile(User user, string? loginCompanyId, string? loginSectorId)
    {
        // For cross-sector login (Admin/OP), use the requested sector
        var isCrossLogin = !string.IsNullOrWhiteSpace(loginCompanyId)
            && !string.IsNullOrWhiteSpace(loginSectorId)
            && (user.CompanyId != loginCompanyId || user.SectorId != loginSectorId);

        var effectiveCompanyId = isCrossLogin ? loginCompanyId! : user.CompanyId;
        var effectiveSectorId = isCrossLogin ? loginSectorId! : user.SectorId;

        var sectorGroup = await _db.SectorGroups
            .FirstOrDefaultAsync(sg => sg.SectorId == effectiveSectorId);

        var sectorIds = new List<string> { effectiveSectorId };
        if (sectorGroup != null)
        {
            sectorIds = await _db.SectorGroups
                .Where(sg => sg.GroupId == sectorGroup.GroupId)
                .Select(sg => sg.SectorId)
                .ToListAsync();
        }

        return new UserProfile
        {
            Id = user.Id,
            Name = user.Name,
            Matricula = user.Matricula,
            CompanyId = effectiveCompanyId,
            SectorId = effectiveSectorId,
            IsAdmin = user.IsAdmin,
            IsTruck = user.IsTruck,
            IsOP = user.IsOP,
            Shift = user.Shift,
            PhotoURL = user.PhotoURL,
            Email = user.Email,
            SectorIds = sectorIds,
            GroupId = sectorGroup?.GroupId
        };
    }

    private (string token, string refreshToken) GenerateTokens(IdentityUser identityUser, UserProfile profile)
    {
        var jwtKey = _config["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, identityUser.Id),
            new(ClaimTypes.Name, profile.Name),
            new("matricula", profile.Matricula),
            new("companyId", profile.CompanyId),
            new("sectorId", profile.SectorId),
            new(ClaimTypes.Role, profile.IsOP ? "OP" : profile.IsAdmin ? "Admin" : "Driver"),
            new("shift", profile.Shift.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: credentials
        );

        var jwt = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        return (jwt, refreshToken);
    }

    private static string HashToken(string token)
    {
        return Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    }
}
