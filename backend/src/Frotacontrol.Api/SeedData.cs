using Microsoft.AspNetCore.Identity;
using Frotacontrol.Infrastructure.Data;

namespace Frotacontrol.Api;

public static class SeedData
{
    public static async Task Initialize(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

        foreach (var role in new[] { "Driver", "Admin", "OP" })
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }
    }
}
