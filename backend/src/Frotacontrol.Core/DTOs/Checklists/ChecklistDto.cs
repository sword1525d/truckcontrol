namespace Frotacontrol.Core.DTOs.Checklists;

public class ChecklistDto
{
    public Guid Id { get; set; }
    public string VehicleId { get; set; } = string.Empty;
    public string DriverId { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public DateTimeOffset Timestamp { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public string SectorId { get; set; } = string.Empty;
    public List<ChecklistItemDto> Items { get; set; } = new();
}

public class ChecklistItemDto
{
    public int Id { get; set; }
    public string ItemId { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Observation { get; set; }
    public string? Images { get; set; }
}

public class SubmitChecklistRequest
{
    public string DriverId { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public List<SubmitChecklistItemRequest> Items { get; set; } = new();
}

public class SubmitChecklistItemRequest
{
    public string ItemId { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Observation { get; set; }
    public string? Images { get; set; }
}
