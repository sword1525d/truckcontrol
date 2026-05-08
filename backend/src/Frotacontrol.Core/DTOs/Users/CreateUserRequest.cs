using System.ComponentModel.DataAnnotations;

namespace Frotacontrol.Core.DTOs.Users;

public class CreateUserRequest
{
    [Required]
    public string Matricula { get; set; } = string.Empty;

    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    public string? Role { get; set; }

    public int Shift { get; set; }

    public bool IsAdmin { get; set; }

    public bool IsTruck { get; set; } = true;

    public bool IsOP { get; set; }

    public string? PhotoURL { get; set; }

    public string? Email { get; set; }

    public string? Permitidos { get; set; }
}

public class UpdateUserRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;

    public bool IsAdmin { get; set; }

    public bool IsTruck { get; set; }

    public int Shift { get; set; }

    public bool IsOP { get; set; }

    public string? PhotoURL { get; set; }

    public string? Email { get; set; }

    public string? Permitidos { get; set; }
}
