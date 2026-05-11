using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Frotacontrol.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/checklists/photos")]
public class PhotosController : ControllerBase
{
    private readonly IWebHostEnvironment _env;

    public PhotosController(IWebHostEnvironment env)
    {
        _env = env;
    }

    [HttpPost]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file provided" });

        if (!file.ContentType.StartsWith("image/"))
            return BadRequest(new { error = "File must be an image" });

        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(new { error = "File too large (max 10MB)" });

        var uploadsDir = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), "uploads", "checklists");
        Directory.CreateDirectory(uploadsDir);

        var filename = $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{Guid.NewGuid():N}.jpg";
        var filePath = Path.Combine(uploadsDir, filename);

        await using var stream = new FileStream(filePath, FileMode.Create);
        await file.CopyToAsync(stream);

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        return Ok(new { url = $"{baseUrl}/uploads/checklists/{filename}" });
    }
}
