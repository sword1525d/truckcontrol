namespace Frotacontrol.Core.DTOs.Email;

public class ChecklistNonConformanceItem
{
    public string ItemId { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Observation { get; set; }
    public string? Images { get; set; } // JSON array string
}
