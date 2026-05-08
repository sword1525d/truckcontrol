using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Frotacontrol.Core.Entities;

public class Sector
{
    [MaxLength(50)]
    public string Id { get; set; } = string.Empty;

    [MaxLength(50)]
    public string CompanyId { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [ForeignKey(nameof(CompanyId))]
    public Company Company { get; set; } = null!;

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
}
