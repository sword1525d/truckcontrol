namespace Frotacontrol.Core.DTOs.Routes;

public class RouteDto
{
    public Guid Id { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public string SectorId { get; set; } = string.Empty;
    public string VehicleId { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public int Shift { get; set; }
    public bool IsFixed { get; set; }
    public List<TripDto> Trips { get; set; } = new();
}

public class TripDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public List<TripStopDto> Stops { get; set; } = new();
}

public class TripStopDto
{
    public int Id { get; set; }
    public int SortOrder { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PlannedArrival { get; set; } = string.Empty;
    public string PlannedDeparture { get; set; } = string.Empty;
}

public class CreateRouteRequest
{
    public string VehicleId { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public int Shift { get; set; }
    public bool IsFixed { get; set; }
    public List<CreateTripRequest> Trips { get; set; } = new();
}

public class CreateTripRequest
{
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public List<CreateTripStopRequest> Stops { get; set; } = new();
}

public class CreateTripStopRequest
{
    public int SortOrder { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PlannedArrival { get; set; } = string.Empty;
    public string PlannedDeparture { get; set; } = string.Empty;
}

public class UpdateRouteRequest
{
    public string VehicleId { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public int Shift { get; set; }
    public bool IsFixed { get; set; }
    public List<CreateTripRequest> Trips { get; set; } = new();
}
