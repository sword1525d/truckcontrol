using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Frotacontrol.Core.Enums;

namespace Frotacontrol.Core.Entities;

public class ChecklistItem
{
    public int Id { get; set; }

    public Guid ChecklistId { get; set; }

    [MaxLength(50)]
    public string ItemId { get; set; } = string.Empty;

    /// <summary>
    /// A, B, C, or D (criticality level)
    /// </summary>
    [MaxLength(1)]
    public string Location { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    public ChecklistItemStatus Status { get; set; }

    [MaxLength(500)]
    public string? Observation { get; set; }

    /// <summary>
    /// JSON array of image URLs
    /// </summary>
    public string? Images { get; set; }

    [ForeignKey(nameof(ChecklistId))]
    public Checklist Checklist { get; set; } = null!;
}
