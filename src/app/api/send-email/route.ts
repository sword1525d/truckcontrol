import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { driverName, vehicleId, items, managersEmails, date, isBlocked, type, managerName } = data;

    if (!vehicleId || !managersEmails) {
      return NextResponse.json({ error: 'Dados incompletos para envio de e-mail.' }, { status: 400 });
    }

    if (managersEmails.length === 0) {
      return NextResponse.json({ message: 'Nenhum gestor cadastrado para envio.' }, { status: 200 });
    }

    const apiUrl = process.env.EMAIL_SERVICE_URL;
    const apiKey = process.env.EMAIL_API_SECRET_KEY;

    if (!apiUrl || !apiKey) {
      console.error("Variáveis de ambiente do serviço de e-mail não configuradas.");
      return NextResponse.json({ error: 'Configuração do servidor de e-mail ausente.' }, { status: 500 });
    }

    let subject = '';
    let htmlContent = '';

    if (type === 'UNLOCK') {
        subject = `✅ DESBLOQUEIO: Caminhão ${vehicleId} Liberado`;
        htmlContent = `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #09090b; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em;">Frotacontrol</h1>
            <p style="color: #a1a1aa; margin: 8px 0 0 0; font-size: 14px;">Aviso de Desbloqueio</p>
            </div>
            
            <div style="padding: 32px 24px;">
            <div style="background-color: #dcfce7; border-left: 4px solid #22c55e; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; color: #166534; font-weight: 500; font-size: 15px;">O veículo <strong>${vehicleId}</strong> foi desbloqueado e está liberado para circulação.</p>
            </div>

            <div style="background-color: #f4f4f5; padding: 20px; border-radius: 8px; margin-bottom: 32px; border: 1px solid #e5e7eb;">
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #52525b;">O bloqueio por não conformidades de grau elevado no checklist foi removido sob responsabilidade gerencial.</p>
                <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                <div>
                    <p style="margin: 0 0 2px 0; font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Autorizado Por</p>
                    <p style="margin: 0; font-size: 15px; color: #27272a; font-weight: bold;">${managerName}</p>
                </div>
                <div>
                    <p style="margin: 0 0 2px 0; font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Data e Hora da Liberação</p>
                    <p style="margin: 0; font-size: 15px; color: #27272a; font-weight: 500;">${date}</p>
                </div>
                </div>
            </div>
            </div>
            
            <div style="background-color: #f4f4f5; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #71717a;">Este é um e-mail automático gerado pelo sistema Frotacontrol. Por favor, não responda.</p>
            </div>
        </div>
        `;
    } else {
        subject = `⚠️ ALERTA: Não Conformidade Identificada - Caminhão ${vehicleId}`;
        htmlContent = `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #09090b; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em;">Frotacontrol</h1>
            <p style="color: #a1a1aa; margin: 8px 0 0 0; font-size: 14px;">Alerta de Check-list</p>
            </div>
            
            <div style="padding: 32px 24px;">
            ${isBlocked ? `
            <div style="background-color: #7f1d1d; color: white; padding: 16px; border-radius: 8px; margin-bottom: 24px; text-align: center; font-weight: bold; border: 2px solid #ef4444;">
                <p style="margin: 0; font-size: 16px; text-transform: uppercase;">🚫 CAMINHÃO BLOQUEADO AUTOMATICAMENTE</p>
                <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: normal; opacity: 0.9;">Identificado defeito de Grau A ou B. A operação deste veículo está suspensa até o desbloqueio gerencial.</p>
            </div>
            ` : `
            <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; color: #991b1b; font-weight: 500; font-size: 15px;">Atenção: Foram identificadas não conformidades no veículo <strong>${vehicleId}</strong>.</p>
            </div>
            `}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background-color: #f4f4f5; padding: 16px; border-radius: 8px; margin-bottom: 32px;">
                <div>
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Motorista</p>
                <p style="margin: 0; font-size: 15px; color: #27272a; font-weight: 500;">${driverName}</p>
                </div>
                <div>
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #71717a; text-transform: uppercase; font-weight: 600;">Data do Registro</p>
                <p style="margin: 0; font-size: 15px; color: #27272a; font-weight: 500;">${date}</p>
                </div>
            </div>

            <h2 style="font-size: 18px; color: #09090b; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-top: 0; margin-bottom: 24px;">Detalhes das Não Conformidades</h2>

            ${items.map((item: any) => `
                <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; ${(item.location === 'A' || item.location === 'B') ? 'border-color: #ef4444;' : ''}">
                <div style="background-color: #f4f4f5; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <h3 style="margin: 0; font-size: 15px; color: #09090b;">
                    <span style="background-color: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 8px; font-weight: bold;">NC</span>
                    ${item.id} - ${item.title}
                    </h3>
                </div>
                <div style="padding: 16px;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #52525b;">${item.description}</p>
                    <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #d97706; font-weight: 600; text-transform: uppercase;">Observação do Motorista:</p>
                    <p style="margin: 0; font-size: 14px; color: #92400e; font-style: italic;">"${item.observation || 'Nenhuma observação informada.'}"</p>
                    </div>
                    
                    ${item.images && item.images.length > 0 ? `
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #71717a; font-weight: 600; text-transform: uppercase;">Evidências Fotográficas:</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${item.images.map((img: string) => `
                        <a href="${img}" target="_blank" style="display: inline-block;">
                            <img src="${img}" alt="Evidência" style="width: 120px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb;" />
                        </a>
                        `).join('')}
                    </div>
                    ` : '<p style="margin: 0; font-size: 13px; color: #a1a1aa; font-style: italic;">Nenhuma foto anexada.</p>'}
                </div>
                </div>
            `).join('')}
            </div>
            
            <div style="background-color: #f4f4f5; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #71717a;">Este é um e-mail automático gerado pelo sistema Frotacontrol. Por favor, não responda.</p>
            </div>
        </div>
        `;
    }

    const payload: any = {
      to: managersEmails,
      subject: subject,
      html: htmlContent,
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        "Importance": "High"
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na API de e-mail:", errorText);
      return NextResponse.json({ error: 'Falha ao enviar o e-mail pela API externa.' }, { status: response.status });
    }

    const responseData = await response.json();
    return NextResponse.json({ success: true, data: responseData });

  } catch (error) {
    console.error('Erro interno na rota send-email:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
