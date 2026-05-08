using Frotacontrol.Core.DTOs.Companies;

namespace Frotacontrol.Core.Interfaces;

public interface ICompanyService
{
    Task<List<CompanyDto>> GetAllAsync();
    Task<CompanyDto> CreateAsync(CreateCompanyRequest request);
    Task DeleteAsync(string id);

    Task<List<SectorDto>> GetSectorsAsync(string companyId);
    Task<SectorDto> CreateSectorAsync(string companyId, CreateSectorRequest request);
    Task DeleteSectorAsync(string companyId, string sectorId);

    Task<List<GroupDto>> GetGroupsAsync(string companyId);
    Task<GroupDto> CreateGroupAsync(string companyId, CreateGroupRequest request);
    Task DeleteGroupAsync(string companyId, string groupId);

    Task AssignSectorToGroupAsync(string companyId, string sectorId, string groupId);
    Task RemoveSectorFromGroupAsync(string companyId, string sectorId);
}
