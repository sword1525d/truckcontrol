using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Frotacontrol.Core.Interfaces;

namespace Frotacontrol.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly HttpClient _http;
    private readonly string? _emailApiUrl;

    public EmailService(HttpClient http, IConfiguration config)
    {
        _http = http;
        _emailApiUrl = config["EmailService:Url"];
    }

    public async Task SendChecklistNonConformanceAsync(string driverName, string vehicleId, List<string> itemDescriptions, List<string> managerEmails, DateTimeOffset date, bool isBlocked)
    {
        var itemsText = string.Join("\n- ", itemDescriptions);
        var blockedText = isBlocked
            ? "O veículo foi BLOQUEADO e não pode iniciar novas corridas até que um administrador faça o desbloqueio."
            : "Itens de grau C/D com não-conformidade. O veículo NÃO foi bloqueado.";

        var subject = $"[Frotacontrol] Não-conformidade no checklist - {vehicleId}";
        var body = $"""
            Checklist do dia {date:dd/MM/yyyy} para o veículo {vehicleId} apresentou não-conformidades.

            Motorista: {driverName}
            Data: {date:dd/MM/yyyy HH:mm}

            Itens não-conformes:
            - {itemsText}

            {blockedText}

            Acesse o sistema Frotacontrol para mais detalhes.
            """;

        await SendEmailAsync(managerEmails, subject, body);
    }

    public async Task SendVehicleUnblockedAsync(string vehicleId, string adminName, List<string> managerEmails, DateTimeOffset date)
    {
        var subject = $"[Frotacontrol] Veículo desbloqueado - {vehicleId}";
        var body = $"""
            O veículo {vehicleId} foi desbloqueado manualmente.

            Administrador responsável: {adminName}
            Data: {date:dd/MM/yyyy HH:mm}

            O veículo já está disponível para novas corridas.

            Acesse o sistema Frotacontrol para mais detalhes.
            """;

        await SendEmailAsync(managerEmails, subject, body);
    }

    private async Task SendEmailAsync(List<string> to, string subject, string body)
    {
        if (string.IsNullOrWhiteSpace(_emailApiUrl))
        {
            // No email service configured — log and skip
            Console.WriteLine($"[Email] SKIP (no service configured) — To: {string.Join(", ", to)} — Subject: {subject}");
            return;
        }

        try
        {
            var payload = new { to, subject, body };
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _http.PostAsync(_emailApiUrl, content);
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[Email] FAILED ({response.StatusCode}) — To: {string.Join(", ", to)} — Subject: {subject}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Email] ERROR: {ex.Message} — To: {string.Join(", ", to)} — Subject: {subject}");
        }
    }
}
