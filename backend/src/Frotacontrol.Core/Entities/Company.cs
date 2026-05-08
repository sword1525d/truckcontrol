using System.ComponentModel.DataAnnotations;

namespace Frotacontrol.Core.Entities;

public class Company
{
    [MaxLength(50)]
    public string Id { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public ICollection<Sector> Sectors { get; set; } = new List<Sector>();
    public ICollection<Group> Groups { get; set; } = new List<Group>();
}
