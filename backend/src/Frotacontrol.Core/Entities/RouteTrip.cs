using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Frotacontrol.Core.Entities;

public class RouteTrip
{
    public Guid Id { get; set; }

    public Guid RouteId { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    [ForeignKey(nameof(RouteId))]
    public Route Route { get; set; } = null!;

    public ICollection<RouteTripStop> Stops { get; set; } = new List<RouteTripStop>();
}
