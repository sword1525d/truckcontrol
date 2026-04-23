/**
 * Camada de acesso ao Firebase Realtime Database legado do módulo Carro.
 * URL: https://lslcda-default-rtdb.firebaseio.com
 *
 * Estrutura:
 *   /{empresa}/{setor}/corridas/{id}
 *   /{empresa}/{setor}/veiculos/{nome}
 *   /{empresa}/{setor}/agendamentos/{veiculo}/{id}
 *   /{empresa}/{setor}/users/{matricula}
 *   /{empresa}/SETORES
 *   /empresas
 *
 * Auth do carro é própria: localStorage.getItem('car_usuario')
 * contém: { nome, mat, empresa, setor, role, pass, permitidos[] }
 */

export const CAR_RTDB_URL = 'https://lslcda-default-rtdb.firebaseio.com';

export type CarUsuario = {
  nome: string;
  mat: string;
  empresa: string;
  setor: string;
  role?: string;
  adm?: boolean;
  truck?: boolean;
  em_corrida?: boolean;
  permitidos?: string[];
  pass?: string;
};

export type CarVeiculo = {
  placa?: string;
  status?: string;
  motorista?: string;
  destino?: string;
  km_rodados?: string | number;
  gasolina?: number | string;
  modelo?: string;
  'ÚLTIMO A USAR'?: string;
};

export type CarCorrida = {
  data: string;
  destino: string;
  horario_inicio: string;
  horario_fim?: string;
  km_inicial: string | number;
  km_final?: string | number;
  responsavel: string;
  veículo: string;
  gasolina?: string | number;
};

export type CarAgendamento = {
  data: string;
  hora_inicio: string;
  hora_fim: string;
  responsavel: string;
  matricula: string;
  status: 'confirmado' | 'cancelado' | 'pendente';
  veiculo?: string;
  motivo?: string;
};

/** Lê JSON de um path do RTDB */
async function rtdbGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${CAR_RTDB_URL}/${path}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`RTDB GET ${path} falhou: ${res.status}`);
  return res.json() as Promise<T | null>;
}

/** Escreve (PUT) JSON em um path do RTDB */
async function rtdbPut<T>(path: string, data: T): Promise<void> {
  const res = await fetch(`${CAR_RTDB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`RTDB PUT ${path} falhou: ${res.status}`);
}

/** Atualiza (PATCH) campos de um nó do RTDB */
async function rtdbPatch<T extends object>(path: string, data: Partial<T>): Promise<void> {
  const res = await fetch(`${CAR_RTDB_URL}/${path}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`RTDB PATCH ${path} falhou: ${res.status}`);
}

// ---------- Helpers de session ----------------------------------------

export function getCarUsuario(): CarUsuario | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('car_usuario');
  if (!raw) return null;
  try { return JSON.parse(raw) as CarUsuario; } catch { return null; }
}

export function setCarUsuario(u: CarUsuario): void {
  localStorage.setItem('car_usuario', JSON.stringify(u));
}

export function clearCarUsuario(): void {
  localStorage.removeItem('car_usuario');
}

// ---------- Empresas / Setores ----------------------------------------

export async function fetchEmpresas(): Promise<Record<string, unknown> | null> {
  return rtdbGet<Record<string, unknown>>('empresas');
}

export async function fetchSetores(empresa: string): Promise<Record<string, unknown> | null> {
  return rtdbGet<Record<string, unknown>>(`${empresa}/SETORES`);
}

// ---------- Autenticação ----------------------------------------------

export async function carLogin(
  empresa: string,
  setor: string,
  matricula: string,
  senha: string
): Promise<CarUsuario> {
  const userData = await rtdbGet<CarUsuario & { pass?: string }>(
    `${empresa}/${setor}/users/${matricula}`
  );
  if (!userData || userData.pass !== senha) {
    throw new Error('Matrícula ou senha incorretos.');
  }
  const usuario: CarUsuario = {
    nome: userData.nome,
    mat: matricula,
    empresa,
    setor,
    role: userData.role,
    adm: userData.adm,
    truck: userData.truck,
    em_corrida: userData.em_corrida,
    permitidos: userData.permitidos,
  };
  setCarUsuario(usuario);
  return usuario;
}

// ---------- Veículos --------------------------------------------------

export async function fetchVeiculos(
  empresa: string,
  setor: string
): Promise<Record<string, CarVeiculo> | null> {
  return rtdbGet<Record<string, CarVeiculo>>(`${empresa}/${setor}/veiculos`);
}

export async function fetchVeiculosPermitidos(
  empresa: string,
  setor: string,
  permitidos: string[]
): Promise<Record<string, CarVeiculo>> {
  const veiculos = await fetchVeiculos(empresa, setor);
  if (!veiculos) return {};
  return Object.fromEntries(
    Object.entries(veiculos).filter(([, v]) => v && permitidos.includes(v.placa ?? ''))
  );
}

export async function updateVeiculo(
  empresa: string,
  setor: string,
  veiculoId: string,
  data: Partial<CarVeiculo>
): Promise<void> {
  return rtdbPatch<CarVeiculo>(`${empresa}/${setor}/veiculos/${veiculoId}`, data);
}

// ---------- Corridas --------------------------------------------------

export async function fetchCorridas(
  empresa: string,
  setor: string
): Promise<Record<string, CarCorrida> | null> {
  return rtdbGet<Record<string, CarCorrida>>(`${empresa}/${setor}/corridas`);
}

export async function criarCorrida(
  empresa: string,
  setor: string,
  corrida: CarCorrida
): Promise<string> {
  const corridas = await fetchCorridas(empresa, setor);
  const novoId = corridas ? String(Object.keys(corridas).length) : '0';
  await rtdbPut(`${empresa}/${setor}/corridas/${novoId}`, corrida);
  return novoId;
}

export async function encerrarCorrida(
  empresa: string,
  setor: string,
  corridaKey: string,
  data: Pick<CarCorrida, 'km_final' | 'horario_fim' | 'gasolina'>
): Promise<void> {
  return rtdbPatch(`${empresa}/${setor}/corridas/${corridaKey}`, data);
}

export async function getCorridaAtiva(
  empresa: string,
  setor: string,
  nomeUsuario: string
): Promise<{ key: string; corrida: CarCorrida } | null> {
  const corridas = await fetchCorridas(empresa, setor);
  if (!corridas) return null;
  for (const [key, c] of Object.entries(corridas)) {
    if (c && c.responsavel === nomeUsuario && !c.horario_fim) {
      return { key, corrida: c };
    }
  }
  return null;
}

// ---------- Agendamentos ----------------------------------------------

export async function fetchAgendamentosVeiculo(
  empresa: string,
  setor: string,
  veiculoId: string
): Promise<Record<string, CarAgendamento> | null> {
  return rtdbGet<Record<string, CarAgendamento>>(
    `${empresa}/${setor}/agendamentos/${veiculoId}`
  );
}

export async function fetchTodosAgendamentos(
  empresa: string,
  setor: string
): Promise<Record<string, Record<string, CarAgendamento>> | null> {
  return rtdbGet(`${empresa}/${setor}/agendamentos`);
}

export async function criarAgendamento(
  empresa: string,
  setor: string,
  veiculoId: string,
  agendamento: CarAgendamento
): Promise<string> {
  const existentes = await fetchAgendamentosVeiculo(empresa, setor, veiculoId);
  const novoId = existentes ? String(Object.keys(existentes).length) : '0';
  await rtdbPut(
    `${empresa}/${setor}/agendamentos/${veiculoId}/${novoId}`,
    agendamento
  );
  return novoId;
}

// ---------- Usuário ---------------------------------------------------

export async function updateUsuarioStatus(
  empresa: string,
  matricula: string,
  data: { em_corrida: boolean }
): Promise<void> {
  return rtdbPatch(`${empresa}/user/${matricula}`, data);
}

// ---------- Utils ------------------------------------------------------

/** Verifica se um veículo está em corrida ativa */
export function veiculoEmCorridaAtiva(
  corridas: Record<string, CarCorrida> | null,
  veiculoId: string
): CarCorrida | null {
  if (!corridas) return null;
  const ativas = Object.values(corridas).filter(
    (c) => c && c['veículo'] === veiculoId && !c.horario_fim
  );
  if (ativas.length === 0) return null;
  return ativas.sort((a, b) => {
    const parse = (c: CarCorrida) =>
      new Date(`${c.data.split('/').reverse().join('-')}T${c.horario_inicio}`).getTime();
    return parse(b) - parse(a);
  })[0];
}

/** Verifica se há agendamento ativo para o veículo no momento */
export function agendamentoAtivoAgora(
  agendamentos: Record<string, CarAgendamento> | null
): CarAgendamento | null {
  if (!agendamentos) return null;
  const agora = new Date();
  const dataAtual = agora.toLocaleDateString('pt-BR');
  const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    Object.values(agendamentos).find(
      (a) =>
        a &&
        a.status === 'confirmado' &&
        a.data === dataAtual &&
        a.hora_inicio <= horaAtual &&
        a.hora_fim >= horaAtual
    ) ?? null
  );
}
