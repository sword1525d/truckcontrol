using Microsoft.AspNetCore.Identity;
using Frotacontrol.Core.Entities;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Api;

public static class SeedData
{
    public static async Task Initialize(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var db = services.GetRequiredService<AppDbContext>();

        // Seed roles
        foreach (var role in new[] { "Driver", "Admin", "OP" })
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }

        // Seed default stop points (67 factory locations)
        if (!db.StopPoints.Any())
        {
            var stops = new[]
            {
                "PINTURA ABS", "DIVISÃO PEÇAS", "ARO", "PINT ALUMÍNIO", "LINHA FUN",
                "USINAGEM", "MOCOM 2", "POLIMENTO", "ESTOQUE F", "PINTURA SPC",
                "FUNDIÇÃO", "INJEÇÃO PLÁSTICA", "MOCOM 4", "MONT RODA", "SINTERIZAÇÃO",
                "LINHA 2", "JUTAI", "PINTURA PO", "PINT TANQUE", "PINT ALTA TEMP",
                "SOLDA TANQUE", "PINTURA FAIXA", "CX DE ASSESORIO", "HDA 1", "MOCOM MOTOR",
                "PINT ESCAPAMENTO", "LINHA 4", "GALVANOPLASTIA", "PRENSA 1", "MOCOM 1",
                "HDA 2", "MOCOM 5", "POWER TRAIN", "MOCOM ABS", "NACIONAL",
                "IMPORTADO", "SOLDA GARFO", "DEPOSITO F", "FAB ASSENTO 2", "SOLDA COMPONENTE",
                "DEPOSITO D", "MOTOR", "HCA", "FAB ASSENTO", "SOLDA ESCAPAMENTO",
                "MOCOM 3", "SOLDA CHASSI", "FAB TUBO", "LM ATV", "FAIXA ABS",
                "FILTRO", "KABEL", "ESTAMPARIA", "MONT LINHA FAN", "PINTURA ABS 2",
                "MOCOM MOTOR 2", "MANUTENÇÃO", "PRENSA 2", "CENTRAL DE RESÍDUOS",
                "POSTO DE GASOLINA", "REFEITÓRIO 1", "REFEITÓRIO 2", "REFEITÓRIO 3",
                "REFEITÓRIO 4", "REFEITÓRIO 5"
            };

            db.StopPoints.AddRange(stops.Select(s => new StopPoint { Name = s, IsActive = true }));
            await db.SaveChangesAsync();
        }
    }
}
