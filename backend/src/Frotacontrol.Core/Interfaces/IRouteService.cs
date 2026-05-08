using Frotacontrol.Core.DTOs.Routes;
using Frotacontrol.Core.DTOs.StopPoints;

namespace Frotacontrol.Core.Interfaces;

public interface IRouteService
{
    Task<List<RouteDto>> GetRoutesAsync(string companyId, string sectorId, string? date = null, int? shift = null, string? vehicleId = null);
    Task<RouteDto?> GetRouteAsync(string companyId, string sectorId, Guid routeId);
    Task<RouteDto> CreateRouteAsync(string companyId, string sectorId, CreateRouteRequest request);
    Task<RouteDto> UpdateRouteAsync(string companyId, string sectorId, Guid routeId, UpdateRouteRequest request);
    Task DeleteRouteAsync(string companyId, string sectorId, Guid routeId);

    // Stop points
    Task<List<StopPointDto>> GetStopPointsAsync();
    Task<StopPointDto> CreateStopPointAsync(CreateStopPointRequest request);
    Task DeleteStopPointAsync(int id);
}
