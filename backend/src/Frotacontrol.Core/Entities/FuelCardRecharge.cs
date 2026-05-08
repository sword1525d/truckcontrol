using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Frotacontrol.Core.Entities;

public class FuelCardRecharge
{
    public Guid Id { get; set; }

    [MaxLength(20)]
    public string FuelCardVehicleId { get; set; } = string.Empty;

    [Column(TypeName = "decimal(10,2)")]
    public decimal Amount { get; set; }

    public DateTime Date { get; set; }

    public TimeSpan Time { get; set; }

    [MaxLength(200)]
    public string Responsible { get; set; } = string.Empty;

    [ForeignKey(nameof(FuelCardVehicleId))]
    public FuelCard FuelCard { get; set; } = null!;
}
