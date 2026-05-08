using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Frotacontrol.Core.Enums;

namespace Frotacontrol.Core.Entities;

public class Vehicle
{
    [MaxLength(20)]
    public string Id { get; set; } = string.Empty; // Placa

    [MaxLength(50)]
    public string CompanyId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SectorId { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Model { get; set; } = string.Empty;

    public bool IsTruck { get; set; }

    public VehicleStatus Status { get; set; } = VehicleStatus.PARADO;

    [Column(TypeName = "decimal(10,1)")]
    public decimal? LastMileage { get; set; }

    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    [ForeignKey(nameof(CompanyId))]
    public Company Company { get; set; } = null!;

    [ForeignKey(nameof(SectorId))]
    public Sector Sector { get; set; } = null!;

    public ICollection<MaintenanceRecord> MaintenanceRecords { get; set; } = new List<MaintenanceRecord>();
    public ICollection<Checklist> Checklists { get; set; } = new List<Checklist>();
}
