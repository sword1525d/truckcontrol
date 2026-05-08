using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Frotacontrol.Core.DTOs.Users;
using Frotacontrol.Core.Entities;
using Frotacontrol.Core.Interfaces;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly AppDbContext _db;
    private readonly UserManager<IdentityUser> _userManager;

    public UserService(AppDbContext db, UserManager<IdentityUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    public async Task<List<UserDto>> GetUsersAsync(string companyId, string sectorId)
    {
        return await _db.Users
            .Where(u => u.CompanyId == companyId && u.SectorId == sectorId)
            .OrderBy(u => u.Name)
            .Select(u => new UserDto
            {
                Id = u.Id,
                CompanyId = u.CompanyId,
                SectorId = u.SectorId,
                Name = u.Name,
                Matricula = u.Matricula,
                Shift = u.Shift,
                IsAdmin = u.IsAdmin,
                IsTruck = u.IsTruck,
                IsOP = u.IsOP,
                PhotoURL = u.PhotoURL,
                Email = u.Email,
                Permitidos = u.Permitidos
            })
            .ToListAsync();
    }

    public async Task<UserDto?> GetUserAsync(string companyId, string sectorId, string userId)
    {
        var u = await _db.Users.FirstOrDefaultAsync(u =>
            u.Id == userId && u.CompanyId == companyId && u.SectorId == sectorId);
        if (u == null) return null;

        return new UserDto
        {
            Id = u.Id,
            CompanyId = u.CompanyId,
            SectorId = u.SectorId,
            Name = u.Name,
            Matricula = u.Matricula,
            Shift = u.Shift,
            IsAdmin = u.IsAdmin,
            IsTruck = u.IsTruck,
            IsOP = u.IsOP,
            PhotoURL = u.PhotoURL,
            Email = u.Email,
            Permitidos = u.Permitidos
        };
    }

    public async Task<UserDto> CreateUserAsync(string companyId, string sectorId, CreateUserRequest request)
    {
        var email = $"{request.Matricula}@frotacontrol.com";

        var identityUser = new IdentityUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(identityUser, request.Password);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(", ", result.Errors.Select(e => e.Description)));

        if (!string.IsNullOrEmpty(request.Role))
        {
            await _userManager.AddToRoleAsync(identityUser, request.Role);
        }

        var user = new User
        {
            Id = identityUser.Id,
            CompanyId = companyId,
            SectorId = sectorId,
            Name = request.Name,
            Matricula = request.Matricula,
            Shift = request.Shift,
            IsAdmin = request.IsAdmin,
            IsTruck = request.IsTruck,
            IsOP = request.IsOP,
            PhotoURL = request.PhotoURL,
            Email = request.Email ?? email,
            Permitidos = request.Permitidos
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return new UserDto
        {
            Id = user.Id,
            CompanyId = user.CompanyId,
            SectorId = user.SectorId,
            Name = user.Name,
            Matricula = user.Matricula,
            Shift = user.Shift,
            IsAdmin = user.IsAdmin,
            IsTruck = user.IsTruck,
            IsOP = user.IsOP,
            PhotoURL = user.PhotoURL,
            Email = user.Email,
            Permitidos = user.Permitidos
        };
    }

    public async Task<UserDto> UpdateUserAsync(string companyId, string sectorId, string userId, UpdateUserRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.Id == userId && u.CompanyId == companyId && u.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"User '{userId}' not found");

        user.Name = request.Name;
        user.IsAdmin = request.IsAdmin;
        user.IsTruck = request.IsTruck;
        user.Shift = request.Shift;
        user.IsOP = request.IsOP;
        user.PhotoURL = request.PhotoURL;
        user.Email = request.Email;
        user.Permitidos = request.Permitidos;

        await _db.SaveChangesAsync();

        return new UserDto
        {
            Id = user.Id,
            CompanyId = user.CompanyId,
            SectorId = user.SectorId,
            Name = user.Name,
            Matricula = user.Matricula,
            Shift = user.Shift,
            IsAdmin = user.IsAdmin,
            IsTruck = user.IsTruck,
            IsOP = user.IsOP,
            PhotoURL = user.PhotoURL,
            Email = user.Email,
            Permitidos = user.Permitidos
        };
    }

    public async Task DeleteUserAsync(string companyId, string sectorId, string userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.Id == userId && u.CompanyId == companyId && u.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"User '{userId}' not found");

        var identityUser = await _userManager.FindByIdAsync(userId);
        if (identityUser != null)
            await _userManager.DeleteAsync(identityUser);

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
    }

    public async Task<UserDto?> GetMyProfileAsync(string userId)
    {
        var u = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (u == null) return null;

        return new UserDto
        {
            Id = u.Id,
            CompanyId = u.CompanyId,
            SectorId = u.SectorId,
            Name = u.Name,
            Matricula = u.Matricula,
            Shift = u.Shift,
            IsAdmin = u.IsAdmin,
            IsTruck = u.IsTruck,
            IsOP = u.IsOP,
            PhotoURL = u.PhotoURL,
            Email = u.Email,
            Permitidos = u.Permitidos
        };
    }
}
