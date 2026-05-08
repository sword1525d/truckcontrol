namespace Frotacontrol.Core.DTOs.Refuels;

public class RefuelDto
{
    public Guid Id { get; set; }
    public string CompanyId { get; set; } = string.Empty;
    public string SectorId { get; set; } = string.Empty;
    public string VehicleId { get; set; } = string.Empty;
    public string DriverId { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public decimal Liters { get; set; }
    public decimal Amount { get; set; }
    public DateTimeOffset Timestamp { get; set; }
}

public class CreateRefuelRequest
{
    public string VehicleId { get; set; } = string.Empty;
    public string DriverId { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public decimal Liters { get; set; }
    public decimal Amount { get; set; }
}
