using System.ComponentModel.DataAnnotations.Schema;

namespace Frotacontrol.Core.Entities;

public class LocationPoint
{
    public long Id { get; set; }

    public Guid RunId { get; set; }

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public DateTimeOffset Timestamp { get; set; }

    [ForeignKey(nameof(RunId))]
    public Run Run { get; set; } = null!;
}
