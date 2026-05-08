using System.ComponentModel.DataAnnotations;

namespace Frotacontrol.Core.DTOs.Auth;

public class LoginRequest
{
    /// <summary>
    /// Use email for admin/manager login. Takes precedence over matricula.
    /// </summary>
    public string? Email { get; set; }

    /// <summary>
    /// Use matricula for driver login. Ignored if Email is provided.
    /// </summary>
    public string? Matricula { get; set; }

    /// <summary>
    /// Required for matricula login. Optional for email login.
    /// </summary>
    public string? CompanyId { get; set; }

    /// <summary>
    /// Required for matricula login. Optional for email login.
    /// </summary>
    public string? SectorId { get; set; }

    [Required]
    public string Password { get; set; } = string.Empty;
}
