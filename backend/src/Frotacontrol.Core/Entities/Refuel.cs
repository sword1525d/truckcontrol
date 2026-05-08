using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Frotacontrol.Core.Entities;

public class Refuel
{
    public Guid Id { get; set; }

    [MaxLength(50)]
    public string CompanyId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SectorId { get; set; } = string.Empty;

    [MaxLength(20)]
    public string VehicleId { get; set; } = string.Empty;

    [MaxLength(450)]
    public string DriverId { get; set; } = string.Empty;

    [MaxLength(200)]
    public string DriverName { get; set; } = string.Empty;

    [Column(TypeName = "decimal(10,2)")]
    public decimal Liters { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal Amount { get; set; }

    public DateTimeOffset Timestamp { get; set; }

    [ForeignKey(nameof(VehicleId))]
    public Vehicle Vehicle { get; set; } = null!;
}
