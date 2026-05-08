using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Frotacontrol.Core.Entities;

public class Route
{
    public Guid Id { get; set; }

    [MaxLength(50)]
    public string CompanyId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SectorId { get; set; } = string.Empty;

    [MaxLength(20)]
    public string VehicleId { get; set; } = string.Empty;

    /// <summary>
    /// "yyyy-MM-dd" or "fixed"
    /// </summary>
    [MaxLength(20)]
    public string Date { get; set; } = string.Empty;

    public int Shift { get; set; }

    public bool IsFixed { get; set; }

    [ForeignKey(nameof(VehicleId))]
    public Vehicle Vehicle { get; set; } = null!;

    public ICollection<RouteTrip> Trips { get; set; } = new List<RouteTrip>();
}
