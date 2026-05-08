using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Frotacontrol.Core.Entities;

public class User
{
    [MaxLength(450)]
    public string Id { get; set; } = string.Empty; // Same as Identity AspNetUsers.Id

    [MaxLength(50)]
    public string CompanyId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SectorId { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Matricula { get; set; } = string.Empty;

    public int Shift { get; set; }

    public bool IsAdmin { get; set; }

    public bool IsTruck { get; set; }

    public bool IsOP { get; set; }

    [MaxLength(500)]
    public string? PhotoURL { get; set; }

    [MaxLength(200)]
    public string? Email { get; set; }

    /// <summary>
    /// JSON array of allowed vehicle plates. Empty means all allowed.
    /// </summary>
    public string? Permitidos { get; set; }

    [MaxLength(500)]
    public string? RefreshTokenHash { get; set; }

    public DateTimeOffset? RefreshTokenExpiry { get; set; }

    [ForeignKey(nameof(CompanyId))]
    public Company Company { get; set; } = null!;

    [ForeignKey(nameof(SectorId))]
    public Sector Sector { get; set; } = null!;
}
