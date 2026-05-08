namespace Frotacontrol.Core.DTOs.Auth;

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public UserProfile Profile { get; set; } = null!;
}

public class UserProfile
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Matricula { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string SectorId { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
    public bool IsTruck { get; set; }
    public bool IsOP { get; set; }
    public int Shift { get; set; }
    public string? PhotoURL { get; set; }
    public string? Email { get; set; }
    public List<string> SectorIds { get; set; } = new();
    public string? GroupId { get; set; }
}
