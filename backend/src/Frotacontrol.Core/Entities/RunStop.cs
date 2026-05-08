using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Frotacontrol.Core.Enums;

namespace Frotacontrol.Core.Entities;

public class RunStop
{
    public int Id { get; set; }

    public Guid RunId { get; set; }

    public int SortOrder { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public StopStatus Status { get; set; } = StopStatus.PENDING;

    [MaxLength(10)]
    public string? PlannedArrival { get; set; }

    [MaxLength(10)]
    public string? PlannedDeparture { get; set; }

    public DateTimeOffset? ArrivalTime { get; set; }

    public DateTimeOffset? DepartureTime { get; set; }

    public int? CollectedOccupiedCars { get; set; }

    public int? CollectedEmptyCars { get; set; }

    [Column(TypeName = "decimal(10,1)")]
    public decimal? MileageAtStop { get; set; }

    public int? Occupancy { get; set; }

    [MaxLength(500)]
    public string? Observation { get; set; }

    [ForeignKey(nameof(RunId))]
    public Run Run { get; set; } = null!;
}
