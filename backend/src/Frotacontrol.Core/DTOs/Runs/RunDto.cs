namespace Frotacontrol.Core.DTOs.Runs;

public class RunDto
{
    public Guid Id { get; set; }
    public string DriverId { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public string VehicleId { get; set; } = string.Empty;
    public Guid? RouteId { get; set; }
    public string? TripId { get; set; }
    public string? TripName { get; set; }
    public int Shift { get; set; }
    public decimal StartMileage { get; set; }
    public DateTimeOffset StartTime { get; set; }
    public DateTimeOffset? EndTime { get; set; }
    public decimal? EndMileage { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<RunStopDto> Stops { get; set; } = new();
    public List<GpsPointDto>? LocationHistory { get; set; }
}

public class RunSummaryDto
{
    public Guid Id { get; set; }
    public string DriverId { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public string VehicleId { get; set; } = string.Empty;
    public Guid? RouteId { get; set; }
    public string? TripName { get; set; }
    public DateTimeOffset StartTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal StartMileage { get; set; }
    public decimal? EndMileage { get; set; }
    public int StopCount { get; set; }
    public int CompletedStops { get; set; }
}

public class RunStopDto
{
    public int Id { get; set; }
    public int SortOrder { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? PlannedArrival { get; set; }
    public string? PlannedDeparture { get; set; }
    public DateTimeOffset? ArrivalTime { get; set; }
    public DateTimeOffset? DepartureTime { get; set; }
    public int? CollectedOccupiedCars { get; set; }
    public int? CollectedEmptyCars { get; set; }
    public decimal? MileageAtStop { get; set; }
    public int? Occupancy { get; set; }
    public string? Observation { get; set; }
}

public class GpsPointDto
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTimeOffset Timestamp { get; set; }
}

public class CreateRunRequest
{
    public string DriverId { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public string VehicleId { get; set; } = string.Empty;
    public Guid? RouteId { get; set; }
    public string? TripId { get; set; }
    public string? TripName { get; set; }
    public int Shift { get; set; }
    public decimal StartMileage { get; set; }
    public List<CreateRunStopRequest> Stops { get; set; } = new();
}

public class CreateRunStopRequest
{
    public string Name { get; set; } = string.Empty;
    public string? PlannedArrival { get; set; }
    public string? PlannedDeparture { get; set; }
}

public class UpdateStopArrivalRequest
{
    public string? Observation { get; set; }
}

public class UpdateStopDepartureRequest
{
    public int? CollectedOccupiedCars { get; set; }
    public int? CollectedEmptyCars { get; set; }
    public decimal? MileageAtStop { get; set; }
    public int? Occupancy { get; set; }
    public string? Observation { get; set; }
    public bool NoMileage { get; set; }
}

public class GpsLocationRequest
{
    public List<GpsPointDto> Locations { get; set; } = new();
}

public class TakeoverRequest
{
    public string NewDriverId { get; set; } = string.Empty;
    public string NewDriverName { get; set; } = string.Empty;
}
