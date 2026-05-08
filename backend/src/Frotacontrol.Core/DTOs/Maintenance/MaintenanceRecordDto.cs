namespace Frotacontrol.Core.DTOs.Maintenance;

public class MaintenanceRecordDto
{
    public Guid Id { get; set; }
    public string VehicleId { get; set; } = string.Empty;
    public DateTimeOffset StartTime { get; set; }
    public DateTimeOffset? EndTime { get; set; }
    public string? Notes { get; set; }
}

public class StartMaintenanceRequest
{
    public string? Notes { get; set; }
}
