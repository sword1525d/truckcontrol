using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Frotacontrol.Core.Enums;

namespace Frotacontrol.Core.Entities;

public class Run
{
    public Guid Id { get; set; }

    [MaxLength(450)]
    public string DriverId { get; set; } = string.Empty;

    [MaxLength(200)]
    public string DriverName { get; set; } = string.Empty;

    [MaxLength(20)]
    public string VehicleId { get; set; } = string.Empty;

    public Guid? RouteId { get; set; }

    [MaxLength(100)]
    public string? TripId { get; set; }

    [MaxLength(200)]
    public string? TripName { get; set; }

    public int Shift { get; set; }

    [Column(TypeName = "decimal(10,1)")]
    public decimal StartMileage { get; set; }

    public DateTimeOffset StartTime { get; set; }

    public DateTimeOffset? EndTime { get; set; }

    [Column(TypeName = "decimal(10,1)")]
    public decimal? EndMileage { get; set; }

    public RunStatus Status { get; set; } = RunStatus.IN_PROGRESS;

    [ForeignKey(nameof(VehicleId))]
    public Vehicle Vehicle { get; set; } = null!;

    public ICollection<RunStop> Stops { get; set; } = new List<RunStop>();
    public ICollection<LocationPoint> LocationHistory { get; set; } = new List<LocationPoint>();
}
