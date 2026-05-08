using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Frotacontrol.Core.Entities;

public class Checklist
{
    public Guid Id { get; set; }

    [MaxLength(20)]
    public string VehicleId { get; set; } = string.Empty;

    [MaxLength(450)]
    public string DriverId { get; set; } = string.Empty;

    [MaxLength(200)]
    public string DriverName { get; set; } = string.Empty;

    public DateTimeOffset Timestamp { get; set; }

    [MaxLength(50)]
    public string CompanyId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SectorId { get; set; } = string.Empty;

    [ForeignKey(nameof(VehicleId))]
    public Vehicle Vehicle { get; set; } = null!;

    public ICollection<ChecklistItem> Items { get; set; } = new List<ChecklistItem>();
}
