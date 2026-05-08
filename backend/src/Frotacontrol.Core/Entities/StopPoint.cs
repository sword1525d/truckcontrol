using System.ComponentModel.DataAnnotations;

namespace Frotacontrol.Core.Entities;

public class StopPoint
{
    public int Id { get; set; }

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}
