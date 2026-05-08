namespace Frotacontrol.Core.DTOs.FuelCards;

public class FuelCardDto
{
    public string VehicleId { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string SectorId { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public List<FuelCardRechargeDto> Recharges { get; set; } = new();
}

public class FuelCardRechargeDto
{
    public Guid Id { get; set; }
    public string FuelCardVehicleId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime Date { get; set; }
    public TimeSpan Time { get; set; }
    public string Responsible { get; set; } = string.Empty;
}

public class CreateFuelCardRequest
{
    public string VehicleId { get; set; } = string.Empty;
    public decimal InitialBalance { get; set; }
}

public class RechargeFuelCardRequest
{
    public decimal Amount { get; set; }
    public string Responsible { get; set; } = string.Empty;
}
