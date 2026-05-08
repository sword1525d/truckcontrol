using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Frotacontrol.Core.Entities;

public class SectorGroup
{
    [MaxLength(50)]
    public string SectorId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string GroupId { get; set; } = string.Empty;

    [ForeignKey(nameof(SectorId))]
    public Sector Sector { get; set; } = null!;

    [ForeignKey(nameof(GroupId))]
    public Group Group { get; set; } = null!;
}
