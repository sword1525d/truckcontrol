using System.ComponentModel.DataAnnotations;

namespace Frotacontrol.Core.Entities;

public class Manager
{
    public Guid Id { get; set; }

    [MaxLength(50)]
    public string CompanyId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SectorId { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;
}
