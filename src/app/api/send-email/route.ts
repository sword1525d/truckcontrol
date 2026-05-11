import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5089';

async function fetchManagers(companyId: string, sectorId: string, authHeader: string | null): Promise<{ name: string; email: string }[]> {
  if (!companyId || !sectorId) return [];
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;
    const res = await fetch(`${API_BASE}/api/companies/${companyId}/sectors/${sectorId}/managers`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data.map((m: any) => ({ name: m.name, email: m.email }));
    return [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const {
      driverName, vehicleId, items, managersEmails, date, isBlocked,
      type, managerName, companyId, sectorId,
    } = data;

    if (!vehicleId) {
      return NextResponse.json({ error: 'Dados incompletos: vehicleId obrigatório.' }, { status: 400 });
    }

    // Resolve managers: use provided emails or fetch from backend
    let resolvedEmails: string[] = managersEmails || [];
    if (resolvedEmails.length === 0 && companyId && sectorId) {
      const authHeader = req.headers.get('Authorization');
      const managers = await fetchManagers(companyId, sectorId, authHeader);
      resolvedEmails = managers.map(m => m.email).filter(Boolean);
    }

    if (resolvedEmails.length === 0) {
      return NextResponse.json({ message: 'Nenhum gestor cadastrado para envio.' }, { status: 200 });
    }

    const apiUrl = process.env.EMAIL_SERVICE_URL;
    const apiKey = process.env.EMAIL_API_SECRET_KEY;

    if (!apiUrl || !apiKey) {
      console.error("Variáveis de ambiente do serviço de e-mail não configuradas.");
      return NextResponse.json({ error: 'Configuração do servidor de e-mail ausente.' }, { status: 500 });
    }

    let subject: string;
    let htmlContent: string;

    if (type === 'UNLOCK') {
      subject = `DESBLOQUEIO: Veículo ${vehicleId} — Liberado para Operação`;
      htmlContent = buildUnlockEmail(vehicleId, managerName || 'N/I', date);
    } else {
      const blockText = isBlocked
        ? 'BLOQUEIO AUTOMÁTICO — '
        : '';
      subject = `${blockText}Não Conformidade em Checklist — Veículo ${vehicleId}`;
      htmlContent = buildChecklistEmail(driverName || 'N/I', vehicleId, date || '', items || [], !!isBlocked);
    }

    const payload = {
      to: resolvedEmails,
      subject,
      html: htmlContent,
      headers: {
        'X-Priority': isBlocked ? '1' : '3',
        'X-MSMail-Priority': isBlocked ? 'High' : 'Normal',
        Importance: isBlocked ? 'High' : 'Normal',
      },
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API de e-mail:', errorText);
      return NextResponse.json({ error: 'Falha ao enviar o e-mail pela API externa.' }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro interno na rota send-email:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

function buildUnlockEmail(vehicleId: string, managerName: string, date: string): string {
  return `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #111827; padding: 28px 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">FROTACONTROL</h1>
    <p style="color: #9ca3af; margin: 6px 0 0 0; font-size: 13px; font-weight: 400;">Notificação de Desbloqueio de Veículo</p>
  </div>
  <div style="padding: 32px 24px;">
    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px 20px; border-radius: 0 6px 6px 0; margin-bottom: 28px;">
      <p style="margin: 0; color: #166534; font-weight: 500; font-size: 14px; line-height: 1.6;">
        O veículo <strong style="color: #111827;">${vehicleId}</strong> foi desbloqueado e está novamente autorizado para operação.
      </p>
    </div>
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; border: 1px solid #e5e7eb;">
      <div style="margin-bottom: 16px;">
        <p style="margin: 0 0 2px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Responsável pela Liberação</p>
        <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 600;">${managerName}</p>
      </div>
      <div>
        <p style="margin: 0 0 2px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Data e Hora</p>
        <p style="margin: 0; font-size: 14px; color: #374151;">${date}</p>
      </div>
    </div>
  </div>
  <div style="background-color: #f3f4f6; padding: 14px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; font-size: 11px; color: #9ca3af;">Mensagem automática do sistema Frotacontrol. Não responda a este e-mail.</p>
  </div>
</div>`;
}

function buildChecklistEmail(driverName: string, vehicleId: string, date: string, items: any[], isBlocked: boolean): string {
  const itemCards = items.map((item: any) => {
    const images = typeof item.images === 'string' ? JSON.parse(item.images || '[]') : (item.images || []);
    return `
    <div style="margin-bottom: 20px; border: 1px solid ${(item.location === 'A' || item.location === 'B') ? '#ef4444' : '#e5e7eb'}; border-radius: 6px; overflow: hidden;">
      <div style="background-color: #f9fafb; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
        <h3 style="margin: 0; font-size: 14px; color: #111827; font-weight: 600;">
          <span style="background-color: ${(item.location === 'A' || item.location === 'B') ? '#dc2626' : '#f59e0b'}; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-right: 8px; font-weight: 700; text-transform: uppercase;">NC</span>
          Item ${item.itemId || item.id} — ${item.title}
          <span style="font-size: 10px; color: #6b7280; margin-left: 8px; font-weight: 400;">[Grau ${item.location}]</span>
        </h3>
      </div>
      <div style="padding: 16px;">
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #4b5563; line-height: 1.5;">${item.description}</p>
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 4px; margin-bottom: 14px;">
          <p style="margin: 0 0 4px 0; font-size: 10px; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Observação do Operador</p>
          <p style="margin: 0; font-size: 13px; color: #78350f; font-style: italic;">${item.observation || 'Nenhuma observação registrada.'}</p>
        </div>
        ${images.length > 0 ? `
        <p style="margin: 0 0 8px 0; font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Registro Fotográfico</p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${images.map((img: string) => `
          <a href="${img}" target="_blank" style="display: inline-block;">
            <img src="${img}" alt="Evidência" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #d1d5db;" />
          </a>`).join('')}
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #111827; padding: 28px 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">FROTACONTROL</h1>
    <p style="color: #9ca3af; margin: 6px 0 0 0; font-size: 13px; font-weight: 400;">Relatório de Não Conformidade — Checklist de Vistoria</p>
  </div>
  <div style="padding: 32px 24px;">
    ${isBlocked ? `
    <div style="background-color: #7f1d1d; padding: 18px 20px; border-radius: 6px; margin-bottom: 24px; text-align: center; border: 2px solid #991b1b;">
      <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Veículo Bloqueado Automaticamente</p>
      <p style="margin: 4px 0 0 0; color: #fca5a5; font-size: 12px; font-weight: 400;">Não conformidade de Grau A ou B detectada. A operação deste veículo está suspensa até liberação gerencial.</p>
    </div>` : `
    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 0 6px 6px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #991b1b; font-weight: 500; font-size: 13px;">Foram identificadas não conformidades no veículo <strong style="color: #111827;">${vehicleId}</strong> que requerem atenção.</p>
    </div>`}
    <div style="background-color: #f9fafb; padding: 16px 20px; border-radius: 6px; margin-bottom: 28px; border: 1px solid #e5e7eb;">
      <div style="display: inline-block; margin-right: 48px; vertical-align: top;">
        <p style="margin: 0 0 2px 0; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Veículo</p>
        <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 600;">${vehicleId}</p>
      </div>
      <div style="display: inline-block; margin-right: 48px; vertical-align: top;">
        <p style="margin: 0 0 2px 0; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Operador</p>
        <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 500;">${driverName}</p>
      </div>
      <div style="display: inline-block; vertical-align: top;">
        <p style="margin: 0 0 2px 0; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Data do Registro</p>
        <p style="margin: 0; font-size: 14px; color: #374151;">${date}</p>
      </div>
    </div>
    <h2 style="font-size: 16px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 0; margin-bottom: 20px; font-weight: 600;">Itens Não Conformes</h2>
    ${itemCards}
  </div>
  <div style="background-color: #f3f4f6; padding: 14px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; font-size: 11px; color: #9ca3af;">Mensagem automática do sistema Frotacontrol. Não responda a este e-mail.</p>
  </div>
</div>`;
}
