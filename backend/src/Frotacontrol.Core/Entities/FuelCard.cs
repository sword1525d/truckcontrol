using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Frotacontrol.Core.Entities;

public class FuelCard
{
    [MaxLength(20)]
    public string VehicleId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string CompanyId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SectorId { get; set; } = string.Empty;

    [Column(TypeName = "decimal(10,2)")]
    public decimal Balance { get; set; }

    [ForeignKey(nameof(VehicleId))]
    public Vehicle Vehicle { get; set; } = null!;

    public ICollection<FuelCardRecharge> Recharges { get; set; } = new List<FuelCardRecharge>();
}
