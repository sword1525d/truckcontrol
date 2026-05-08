using System.ComponentModel.DataAnnotations;

namespace Frotacontrol.Core.DTOs.Auth;

public class TokenRefreshRequest
{
    [Required]
    public string RefreshToken { get; set; } = string.Empty;
}
