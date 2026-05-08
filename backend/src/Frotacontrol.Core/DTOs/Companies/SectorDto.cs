namespace Frotacontrol.Core.DTOs.Companies;

public class SectorDto
{
    public string Id { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class CreateSectorRequest
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
