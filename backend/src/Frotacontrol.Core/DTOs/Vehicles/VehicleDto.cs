namespace Frotacontrol.Core.DTOs.Vehicles;

public class VehicleDto
{
    public string Id { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string SectorId { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public bool IsTruck { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal? LastMileage { get; set; }
    public string? ImageUrl { get; set; }
}

public class CreateVehicleRequest
{
    public string Id { get; set; } = string.Empty; // placa
    public string Model { get; set; } = string.Empty;
    public bool IsTruck { get; set; } = true;
    public string? ImageUrl { get; set; }
}

public class UpdateVehicleRequest
{
    public string Model { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
}

public class UpdateVehicleStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

public class UpdateVehicleMileageRequest
{
    public decimal LastMileage { get; set; }
}
