using Microsoft.EntityFrameworkCore;
using Frotacontrol.Core.DTOs.Managers;
using Frotacontrol.Core.Entities;
using Frotacontrol.Core.Interfaces;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Infrastructure.Services;

public class ManagerService : IManagerService
{
    private readonly AppDbContext _db;

    public ManagerService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<ManagerDto>> GetManagersAsync(string companyId, string sectorId)
    {
        return await _db.Managers
            .Where(m => m.CompanyId == companyId && m.SectorId == sectorId)
            .OrderBy(m => m.Name)
            .Select(m => new ManagerDto
            {
                Id = m.Id,
                CompanyId = m.CompanyId,
                SectorId = m.SectorId,
                Name = m.Name,
                Email = m.Email
            })
            .ToListAsync();
    }

    public async Task<ManagerDto> CreateManagerAsync(string companyId, string sectorId, CreateManagerRequest request)
    {
        var manager = new Manager
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SectorId = sectorId,
            Name = request.Name,
            Email = request.Email
        };

        _db.Managers.Add(manager);
        await _db.SaveChangesAsync();

        return new ManagerDto
        {
            Id = manager.Id,
            CompanyId = manager.CompanyId,
            SectorId = manager.SectorId,
            Name = manager.Name,
            Email = manager.Email
        };
    }

    public async Task DeleteManagerAsync(string companyId, string sectorId, Guid managerId)
    {
        var manager = await _db.Managers.FirstOrDefaultAsync(m =>
            m.Id == managerId && m.CompanyId == companyId && m.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"Manager '{managerId}' not found");

        _db.Managers.Remove(manager);
        await _db.SaveChangesAsync();
    }
}
