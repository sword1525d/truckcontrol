namespace Frotacontrol.Core.DTOs.StopPoints;

public class StopPointDto
{
    public int Id { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public string SectorId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class CreateStopPointRequest
{
    public string Name { get; set; } = string.Empty;
}

public class UpdateStopPointRequest
{
    public string Name { get; set; } = string.Empty;
}
