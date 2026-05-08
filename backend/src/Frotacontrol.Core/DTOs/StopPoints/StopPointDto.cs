namespace Frotacontrol.Core.DTOs.StopPoints;

public class StopPointDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class CreateStopPointRequest
{
    public string Name { get; set; } = string.Empty;
}
