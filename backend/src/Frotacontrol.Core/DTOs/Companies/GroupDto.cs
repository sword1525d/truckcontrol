namespace Frotacontrol.Core.DTOs.Companies;

public class GroupDto
{
    public string Id { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class CreateGroupRequest
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class AssignSectorToGroupRequest
{
    public string GroupId { get; set; } = string.Empty;
}
