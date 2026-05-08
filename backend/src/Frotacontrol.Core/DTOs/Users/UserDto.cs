namespace Frotacontrol.Core.DTOs.Users;

public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string SectorId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Matricula { get; set; } = string.Empty;
    public int Shift { get; set; }
    public bool IsAdmin { get; set; }
    public bool IsTruck { get; set; }
    public bool IsOP { get; set; }
    public string? PhotoURL { get; set; }
    public string? Email { get; set; }
    public string? Permitidos { get; set; }
}
