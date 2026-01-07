using Microsoft.AspNetCore.Mvc;
using Octokit;
using System.Text;

namespace PongPush.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UploadController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<UploadController> _logger;

    public UploadController(IConfiguration configuration, ILogger<UploadController> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "Keine Datei hochgeladen" });
            }

            // Validate file is an image
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { error = "Nur Bilddateien sind erlaubt (JPG, PNG, GIF, WEBP)" });
            }

            // Limit file size to 10MB
            if (file.Length > 10 * 1024 * 1024)
            {
                return BadRequest(new { error = "Datei ist zu groß (Maximum 10MB)" });
            }

            // Get GitHub token from environment variable
            var githubToken = Environment.GetEnvironmentVariable("GITHUB_TOKEN");
            if (string.IsNullOrEmpty(githubToken))
            {
                _logger.LogError("GITHUB_TOKEN environment variable not set");
                return StatusCode(500, new { error = "Server-Konfigurationsfehler" });
            }

            var owner = _configuration["GitHub:Owner"] ?? "AppGates";
            var repo = _configuration["GitHub:Repository"] ?? "PongPush";
            var uploadPath = _configuration["GitHub:UploadPath"] ?? "uploads";

            // Create GitHub client
            var client = new GitHubClient(new ProductHeaderValue("PongPush"))
            {
                Credentials = new Credentials(githubToken)
            };

            // Read file content
            byte[] fileContent;
            using (var memoryStream = new MemoryStream())
            {
                await file.CopyToAsync(memoryStream);
                fileContent = memoryStream.ToArray();
            }

            // Generate unique filename with timestamp
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            var sanitizedFileName = Path.GetFileNameWithoutExtension(file.FileName)
                .Replace(" ", "_")
                .Replace("ä", "ae")
                .Replace("ö", "oe")
                .Replace("ü", "ue")
                .Replace("ß", "ss");
            var fileName = $"spielbericht_{timestamp}_{sanitizedFileName}{extension}";
            var filePath = $"{uploadPath}/{fileName}";

            // Upload to GitHub
            var createRequest = new CreateFileRequest(
                $"Upload: {fileName}",
                Convert.ToBase64String(fileContent),
                "claude/photo-upload-cicd-P9UDV" // Use the current branch
            );

            var result = await client.Repository.Content.CreateFile(owner, repo, filePath, createRequest);

            _logger.LogInformation($"File uploaded successfully: {filePath}");

            return Ok(new
            {
                success = true,
                message = "Spielbericht erfolgreich hochgeladen!",
                fileName = fileName,
                filePath = filePath,
                url = result.Content.HtmlUrl
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file");
            return StatusCode(500, new { error = $"Fehler beim Hochladen: {ex.Message}" });
        }
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        var hasToken = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("GITHUB_TOKEN"));
        return Ok(new
        {
            status = "healthy",
            hasGitHubToken = hasToken,
            timestamp = DateTime.UtcNow
        });
    }
}
