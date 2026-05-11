using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Frotacontrol.Core.DTOs.Email;
using Frotacontrol.Core.Interfaces;

namespace Frotacontrol.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly HttpClient _http;
    private readonly string? _emailApiUrl;
    private readonly string? _apiKey;

    public EmailService(HttpClient http, IConfiguration config)
    {
        _http = http;
        _emailApiUrl = config["EmailService:Url"];
        _apiKey = config["EmailService:ApiKey"];
    }

    public async Task SendChecklistNonConformanceAsync(
        string driverName, string vehicleId,
        List<ChecklistNonConformanceItem> items,
        List<string> managerEmails, DateTimeOffset date, bool isBlocked)
    {
        var blockText = isBlocked
            ? "BLOQUEIO AUTOMATICO — "
            : "";
        var subject = $"{blockText}Nao Conformidade em Checklist — Veiculo {vehicleId}";
        var html = BuildChecklistEmail(driverName, vehicleId, date, items, isBlocked);

        await SendEmailAsync(managerEmails, subject, html, isBlocked);
    }

    public async Task SendVehicleUnblockedAsync(
        string vehicleId, string adminName,
        List<string> managerEmails, DateTimeOffset date)
    {
        var subject = $"DESBLOQUEIO: Veiculo {vehicleId} — Liberado para Operacao";
        var html = BuildUnlockEmail(vehicleId, adminName, date);

        await SendEmailAsync(managerEmails, subject, html, false);
    }

    private async Task SendEmailAsync(List<string> to, string subject, string html, bool highPriority)
    {
        if (string.IsNullOrWhiteSpace(_emailApiUrl))
        {
            Console.WriteLine($"[Email] SKIP (no service configured) — To: {string.Join(", ", to)} — Subject: {subject}");
            return;
        }

        try
        {
            var payload = new { to, subject, html };
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, _emailApiUrl)
            {
                Content = content
            };

            if (!string.IsNullOrWhiteSpace(_apiKey))
                request.Headers.Add("x-api-key", _apiKey);

            var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"[Email] FAILED ({response.StatusCode}) {errorBody} — To: {string.Join(", ", to)} — Subject: {subject}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Email] ERROR: {ex.Message} — To: {string.Join(", ", to)} — Subject: {subject}");
        }
    }

    private static string BuildUnlockEmail(string vehicleId, string adminName, DateTimeOffset date)
    {
        var dateStr = date.ToLocalTime().ToString("dd/MM/yyyy 'as' HH:mm");
        return $"""
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #111827; padding: 28px 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">FROTACONTROL</h1>
    <p style="color: #9ca3af; margin: 6px 0 0 0; font-size: 13px; font-weight: 400;">Notificacao de Desbloqueio de Veiculo</p>
  </div>
  <div style="padding: 32px 24px;">
    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px 20px; border-radius: 0 6px 6px 0; margin-bottom: 28px;">
      <p style="margin: 0; color: #166534; font-weight: 500; font-size: 14px; line-height: 1.6;">
        O veiculo <strong style="color: #111827;">{vehicleId}</strong> foi desbloqueado e esta novamente autorizado para operacao.
      </p>
    </div>
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; border: 1px solid #e5e7eb;">
      <div style="margin-bottom: 16px;">
        <p style="margin: 0 0 2px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Responsavel pela Liberacao</p>
        <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 600;">{EscapeHtml(adminName)}</p>
      </div>
      <div>
        <p style="margin: 0 0 2px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Data e Hora</p>
        <p style="margin: 0; font-size: 14px; color: #374151;">{dateStr}</p>
      </div>
    </div>
  </div>
  <div style="background-color: #f3f4f6; padding: 14px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; font-size: 11px; color: #9ca3af;">Mensagem automatica do sistema Frotacontrol. Nao responda a este e-mail.</p>
  </div>
</div>
""";
    }

    private static string BuildChecklistEmail(
        string driverName, string vehicleId, DateTimeOffset date,
        List<ChecklistNonConformanceItem> items, bool isBlocked)
    {
        var dateStr = date.ToLocalTime().ToString("dd/MM/yyyy 'as' HH:mm");
        var itemCards = new StringBuilder();

        foreach (var item in items)
        {
            var borderColor = (item.Location == "A" || item.Location == "B") ? "#ef4444" : "#e5e7eb";
            var badgeColor = (item.Location == "A" || item.Location == "B") ? "#dc2626" : "#f59e0b";
            var imagesHtml = new StringBuilder();

            if (!string.IsNullOrWhiteSpace(item.Images))
            {
                try
                {
                    var urls = JsonSerializer.Deserialize<List<string>>(item.Images);
                    if (urls is { Count: > 0 })
                    {
                        imagesHtml.Append("<p style=\"margin: 0 0 8px 0; font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;\">Registro Fotografico</p>");
                        imagesHtml.Append("<div style=\"display: flex; flex-wrap: wrap; gap: 8px;\">");
                        foreach (var url in urls)
                        {
                            imagesHtml.Append($"<a href=\"{EscapeHtml(url)}\" target=\"_blank\" style=\"display: inline-block;\"><img src=\"{EscapeHtml(url)}\" alt=\"Evidencia\" style=\"width: 100px; height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #d1d5db;\" /></a>");
                        }
                        imagesHtml.Append("</div>");
                    }
                }
                catch { /* ignore malformed images JSON */ }
            }

            itemCards.Append($"""
    <div style="margin-bottom: 20px; border: 1px solid {borderColor}; border-radius: 6px; overflow: hidden;">
      <div style="background-color: #f9fafb; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
        <h3 style="margin: 0; font-size: 14px; color: #111827; font-weight: 600;">
          <span style="background-color: {badgeColor}; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-right: 8px; font-weight: 700; text-transform: uppercase;">NC</span>
          Item {EscapeHtml(item.ItemId)} — {EscapeHtml(item.Title)}
          <span style="font-size: 10px; color: #6b7280; margin-left: 8px; font-weight: 400;">[Grau {EscapeHtml(item.Location)}]</span>
        </h3>
      </div>
      <div style="padding: 16px;">
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #4b5563; line-height: 1.5;">{EscapeHtml(item.Description)}</p>
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 4px; margin-bottom: 14px;">
          <p style="margin: 0 0 4px 0; font-size: 10px; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Observacao do Operador</p>
          <p style="margin: 0; font-size: 13px; color: #78350f; font-style: italic;">{EscapeHtml(string.IsNullOrWhiteSpace(item.Observation) ? "Nenhuma observacao registrada." : item.Observation)}</p>
        </div>
        {imagesHtml}
      </div>
    </div>
""");
        }

        var blockedSection = isBlocked
            ? """
    <div style="background-color: #7f1d1d; padding: 18px 20px; border-radius: 6px; margin-bottom: 24px; text-align: center; border: 2px solid #991b1b;">
      <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Veiculo Bloqueado Automaticamente</p>
      <p style="margin: 4px 0 0 0; color: #fca5a5; font-size: 12px; font-weight: 400;">Nao conformidade de Grau A ou B detectada. A operacao deste veiculo esta suspensa ate liberacao gerencial.</p>
    </div>
"""
            : $"""
    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 0 6px 6px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #991b1b; font-weight: 500; font-size: 13px;">Foram identificadas nao conformidades no veiculo <strong style="color: #111827;">{EscapeHtml(vehicleId)}</strong> que requerem atencao.</p>
    </div>
""";

        return $"""
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #111827; padding: 28px 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">FROTACONTROL</h1>
    <p style="color: #9ca3af; margin: 6px 0 0 0; font-size: 13px; font-weight: 400;">Relatorio de Nao Conformidade — Checklist de Vistoria</p>
  </div>
  <div style="padding: 32px 24px;">
    {blockedSection}
    <div style="background-color: #f9fafb; padding: 16px 20px; border-radius: 6px; margin-bottom: 28px; border: 1px solid #e5e7eb;">
      <div style="display: inline-block; margin-right: 48px; vertical-align: top;">
        <p style="margin: 0 0 2px 0; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Veiculo</p>
        <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 600;">{EscapeHtml(vehicleId)}</p>
      </div>
      <div style="display: inline-block; margin-right: 48px; vertical-align: top;">
        <p style="margin: 0 0 2px 0; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Operador</p>
        <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 500;">{EscapeHtml(driverName)}</p>
      </div>
      <div style="display: inline-block; vertical-align: top;">
        <p style="margin: 0 0 2px 0; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Data do Registro</p>
        <p style="margin: 0; font-size: 14px; color: #374151;">{dateStr}</p>
      </div>
    </div>
    <h2 style="font-size: 16px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 0; margin-bottom: 20px; font-weight: 600;">Itens Nao Conformes</h2>
    {itemCards}
  </div>
  <div style="background-color: #f3f4f6; padding: 14px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; font-size: 11px; color: #9ca3af;">Mensagem automatica do sistema Frotacontrol. Nao responda a este e-mail.</p>
  </div>
</div>
""";
    }

    private static string EscapeHtml(string text)
    {
        return System.Net.WebUtility.HtmlEncode(text ?? string.Empty);
    }
}
