using Frotacontrol.Core.DTOs.Managers;

namespace Frotacontrol.Core.Interfaces;

public interface IManagerService
{
    Task<List<ManagerDto>> GetManagersAsync(string companyId, string sectorId);
    Task<ManagerDto> CreateManagerAsync(string companyId, string sectorId, CreateManagerRequest request);
    Task DeleteManagerAsync(string companyId, string sectorId, Guid managerId);
}
