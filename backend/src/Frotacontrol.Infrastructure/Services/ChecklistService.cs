using Microsoft.EntityFrameworkCore;
using Frotacontrol.Core.DTOs.Checklists;
using Frotacontrol.Core.Entities;
using Frotacontrol.Core.Enums;
using Frotacontrol.Core.Interfaces;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Infrastructure.Services;

public class ChecklistService : IChecklistService
{
    private readonly AppDbContext _db;

    public ChecklistService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<ChecklistDto>> GetHistoryAsync(string companyId, string sectorId, string vehicleId, DateTimeOffset? dateFrom = null, DateTimeOffset? dateTo = null)
    {
        var query = _db.Checklists
            .Include(c => c.Items)
            .Where(c => c.VehicleId == vehicleId && c.CompanyId == companyId && c.SectorId == sectorId);

        if (dateFrom.HasValue)
            query = query.Where(c => c.Timestamp >= dateFrom.Value);
        if (dateTo.HasValue)
            query = query.Where(c => c.Timestamp <= dateTo.Value);

        var checklists = await query.OrderByDescending(c => c.Timestamp).ToListAsync();
        return checklists.Select(ToDto).ToList();
    }

    public async Task<ChecklistDto?> GetTodayAsync(string companyId, string sectorId, string vehicleId)
    {
        var todayStart = DateTimeOffset.UtcNow.Date;
        var todayEnd = todayStart.AddDays(1);

        var checklist = await _db.Checklists
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c =>
                c.VehicleId == vehicleId
                && c.CompanyId == companyId
                && c.SectorId == sectorId
                && c.Timestamp >= todayStart
                && c.Timestamp < todayEnd);

        return checklist == null ? null : ToDto(checklist);
    }

    public async Task<ChecklistDto> SubmitAsync(string companyId, string sectorId, string vehicleId, SubmitChecklistRequest request, Func<Task>? onBlockNotification = null)
    {
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v =>
            v.Id == vehicleId && v.CompanyId == companyId && v.SectorId == sectorId)
            ?? throw new KeyNotFoundException($"Vehicle '{vehicleId}' not found");

        // Validate all items have a valid status (no "na")
        foreach (var item in request.Items)
        {
            if (!Enum.TryParse<ChecklistItemStatus>(item.Status, out _))
                throw new ArgumentException($"Invalid status '{item.Status}' for item '{item.ItemId}'");
        }

        var checklist = new Checklist
        {
            Id = Guid.NewGuid(),
            VehicleId = vehicleId,
            DriverId = request.DriverId,
            DriverName = request.DriverName,
            Timestamp = DateTimeOffset.UtcNow,
            CompanyId = companyId,
            SectorId = sectorId
        };

        foreach (var reqItem in request.Items)
        {
            checklist.Items.Add(new ChecklistItem
            {
                ItemId = reqItem.ItemId,
                Location = reqItem.Location,
                Title = reqItem.Title,
                Description = reqItem.Description,
                Status = Enum.Parse<ChecklistItemStatus>(reqItem.Status),
                Observation = reqItem.Observation,
                Images = reqItem.Images
            });
        }

        _db.Checklists.Add(checklist);

        // Block vehicle if any grade A or B item is non-conforming
        var hasBlockingNonConformance = checklist.Items.Any(i =>
            (i.Location == "A" || i.Location == "B") && i.Status == ChecklistItemStatus.nao_conforme);

        if (hasBlockingNonConformance)
        {
            vehicle.Status = VehicleStatus.BLOQUEADO_CHECKLIST;

            if (onBlockNotification != null)
                await onBlockNotification();
        }

        await _db.SaveChangesAsync();
        return ToDto(checklist);
    }

    private static ChecklistDto ToDto(Checklist c) => new()
    {
        Id = c.Id,
        VehicleId = c.VehicleId,
        DriverId = c.DriverId,
        DriverName = c.DriverName,
        Timestamp = c.Timestamp,
        CompanyId = c.CompanyId,
        SectorId = c.SectorId,
        Items = c.Items.Select(i => new ChecklistItemDto
        {
            Id = i.Id,
            ItemId = i.ItemId,
            Location = i.Location,
            Title = i.Title,
            Description = i.Description,
            Status = i.Status.ToString(),
            Observation = i.Observation,
            Images = i.Images
        }).ToList()
    };
}
