using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Frotacontrol.Core.Entities;

public class RouteTripStop
{
    public int Id { get; set; }

    public Guid TripId { get; set; }

    public int SortOrder { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(10)]
    public string PlannedArrival { get; set; } = string.Empty;

    [MaxLength(10)]
    public string PlannedDeparture { get; set; } = string.Empty;

    [ForeignKey(nameof(TripId))]
    public RouteTrip Trip { get; set; } = null!;
}
