using Microsoft.EntityFrameworkCore;
using Frotacontrol.Core.DTOs.Companies;
using Frotacontrol.Core.Entities;
using Frotacontrol.Core.Interfaces;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Infrastructure.Services;

public class CompanyService : ICompanyService
{
    private readonly AppDbContext _db;

    public CompanyService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<CompanyDto>> GetAllAsync()
    {
        return await _db.Companies
            .OrderBy(c => c.Name)
            .Select(c => new CompanyDto { Id = c.Id, Name = c.Name })
            .ToListAsync();
    }

    public async Task<CompanyDto> CreateAsync(CreateCompanyRequest request)
    {
        var company = new Company { Id = request.Id, Name = request.Name };
        _db.Companies.Add(company);
        await _db.SaveChangesAsync();
        return new CompanyDto { Id = company.Id, Name = company.Name };
    }

    public async Task DeleteAsync(string id)
    {
        var company = await _db.Companies.FindAsync(id);
        if (company == null)
            throw new KeyNotFoundException($"Company '{id}' not found");
        _db.Companies.Remove(company);
        await _db.SaveChangesAsync();
    }

    public async Task<List<SectorDto>> GetSectorsAsync(string companyId)
    {
        return await _db.Sectors
            .Where(s => s.CompanyId == companyId)
            .OrderBy(s => s.Name)
            .Select(s => new SectorDto { Id = s.Id, CompanyId = s.CompanyId, Name = s.Name })
            .ToListAsync();
    }

    public async Task<SectorDto> CreateSectorAsync(string companyId, CreateSectorRequest request)
    {
        var company = await _db.Companies.FindAsync(companyId)
            ?? throw new KeyNotFoundException($"Company '{companyId}' not found");
        var sector = new Sector { Id = request.Id, CompanyId = companyId, Name = request.Name };
        _db.Sectors.Add(sector);
        await _db.SaveChangesAsync();
        return new SectorDto { Id = sector.Id, CompanyId = sector.CompanyId, Name = sector.Name };
    }

    public async Task DeleteSectorAsync(string companyId, string sectorId)
    {
        var sector = await _db.Sectors.FirstOrDefaultAsync(s => s.Id == sectorId && s.CompanyId == companyId)
            ?? throw new KeyNotFoundException($"Sector '{sectorId}' not found");
        _db.Sectors.Remove(sector);
        await _db.SaveChangesAsync();
    }

    public async Task<List<GroupDto>> GetGroupsAsync(string companyId)
    {
        return await _db.Groups
            .Where(g => g.CompanyId == companyId)
            .OrderBy(g => g.Name)
            .Select(g => new GroupDto { Id = g.Id, CompanyId = g.CompanyId, Name = g.Name })
            .ToListAsync();
    }

    public async Task<GroupDto> CreateGroupAsync(string companyId, CreateGroupRequest request)
    {
        var company = await _db.Companies.FindAsync(companyId)
            ?? throw new KeyNotFoundException($"Company '{companyId}' not found");
        var group = new Group { Id = request.Id, CompanyId = companyId, Name = request.Name };
        _db.Groups.Add(group);
        await _db.SaveChangesAsync();
        return new GroupDto { Id = group.Id, CompanyId = group.CompanyId, Name = group.Name };
    }

    public async Task DeleteGroupAsync(string companyId, string groupId)
    {
        var group = await _db.Groups.FirstOrDefaultAsync(g => g.Id == groupId && g.CompanyId == companyId)
            ?? throw new KeyNotFoundException($"Group '{groupId}' not found");
        _db.Groups.Remove(group);
        await _db.SaveChangesAsync();
    }

    public async Task AssignSectorToGroupAsync(string companyId, string sectorId, string groupId)
    {
        var group = await _db.Groups.FirstOrDefaultAsync(g => g.Id == groupId && g.CompanyId == companyId)
            ?? throw new KeyNotFoundException($"Group '{groupId}' not found");
        var sector = await _db.Sectors.FirstOrDefaultAsync(s => s.Id == sectorId && s.CompanyId == companyId)
            ?? throw new KeyNotFoundException($"Sector '{sectorId}' not found");

        var existing = await _db.SectorGroups.FindAsync(sectorId);
        if (existing != null)
            _db.SectorGroups.Remove(existing);

        _db.SectorGroups.Add(new SectorGroup { SectorId = sectorId, GroupId = groupId });
        await _db.SaveChangesAsync();
    }

    public async Task RemoveSectorFromGroupAsync(string companyId, string sectorId)
    {
        var sg = await _db.SectorGroups.FindAsync(sectorId);
        if (sg != null)
        {
            _db.SectorGroups.Remove(sg);
            await _db.SaveChangesAsync();
        }
    }
}
