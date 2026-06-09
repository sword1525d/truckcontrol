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
  op?: boolean;
  truck?: boolean;
  em_corrida?: boolean;
  permitidos?: string[];
  pass?: string;
  grupo?: string;
  setoresGrupo?: string[];
};

export type CarVeiculo = {
  placa?: string;
  status?: string;
  motorista?: string;
  destino?: string;
  km_rodados?: string | number;
  gasolina?: number | string;
  modelo?: string;
  image?: string;
  motivo?: string;
  previsao?: string;
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
  desvios?: { destino: string; hora: string }[];
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

export async function fetchAllSetoresUsuarios(empresa: string): Promise<Record<string, Record<string, CarUsuario & { pass?: string }>> | null> {
  const setores = await fetchSetores(empresa);
  if (!setores) return null;
  const result: Record<string, Record<string, CarUsuario & { pass?: string }>> = {};
  for (const setorKey of Object.keys(setores)) {
    const users = await rtdbGet<Record<string, CarUsuario & { pass?: string }>>(`${empresa}/${setorKey}/users`);
    if (users) result[setorKey] = users;
  }
  return result;
}

// ---------- Empresas / Setores CRUD (OP) --------------------------------

export async function criarEmpresa(empresaKey: string): Promise<void> {
  const empresas = await fetchEmpresas();
  const merged = { ...(empresas || {}), [empresaKey]: true };
  await rtdbPut('empresas', merged);
}

export async function removerEmpresa(empresaKey: string): Promise<void> {
  const empresas = await fetchEmpresas();
  if (!empresas || !empresas[empresaKey]) return;
  // verifica se tem setores
  const setores = await fetchSetores(empresaKey);
  if (setores && Object.keys(setores).length > 0) {
    throw new Error('Empresa possui setores. Remova-os primeiro.');
  }
  delete empresas[empresaKey];
  await rtdbPut('empresas', empresas);
}

export async function criarSetor(empresa: string, setorKey: string): Promise<void> {
  const setores = await fetchSetores(empresa);
  const merged = { ...(setores || {}), [setorKey]: true };
  await rtdbPut(`${empresa}/SETORES`, merged);
}

export async function removerSetor(empresa: string, setorKey: string): Promise<void> {
  // verifica se setor tem dados
  const hasUsers = await rtdbGet(`${empresa}/${setorKey}/users`);
  const hasVeiculos = await rtdbGet(`${empresa}/${setorKey}/veiculos`);
  if ((hasUsers && Object.keys(hasUsers).length > 0) || (hasVeiculos && Object.keys(hasVeiculos).length > 0)) {
    throw new Error('Setor possui dados. Remova usuários e veículos primeiro.');
  }
  const setores = await fetchSetores(empresa);
  if (!setores || !setores[setorKey]) return;
  delete setores[setorKey];
  await rtdbPut(`${empresa}/SETORES`, setores);
}

// ---------- Grupos de Setores ------------------------------------------

export async function fetchGrupos(empresa: string): Promise<Record<string, { nome: string }> | null> {
  return rtdbGet<Record<string, { nome: string }>>(`${empresa}/GRUPOS`);
}

export async function criarGrupo(empresa: string, grupoId: string): Promise<void> {
  const grupos = await fetchGrupos(empresa);
  const merged = { ...(grupos || {}), [grupoId]: { nome: grupoId } };
  await rtdbPut(`${empresa}/GRUPOS`, merged);
}

export async function removerGrupo(empresa: string, grupoId: string): Promise<void> {
  const allSetoresGrupo = await rtdbGet<Record<string, string>>(`${empresa}/GRUPOS_SETORES`);
  if (allSetoresGrupo) {
    const hasSetores = Object.values(allSetoresGrupo).some(g => g === grupoId);
    if (hasSetores) throw new Error('Grupo possui setores vinculados. Remova-os primeiro.');
  }
  const grupos = await fetchGrupos(empresa);
  if (!grupos || !grupos[grupoId]) return;
  delete grupos[grupoId];
  await rtdbPut(`${empresa}/GRUPOS`, grupos);
}

export async function assignSetorToGrupo(empresa: string, setor: string, grupoId: string): Promise<void> {
  await rtdbPut(`${empresa}/GRUPOS_SETORES/${setor}`, grupoId);
}

export async function removeSetorFromGrupo(empresa: string, setor: string): Promise<void> {
  const gruposSetores = await rtdbGet<Record<string, string>>(`${empresa}/GRUPOS_SETORES`);
  if (!gruposSetores || !gruposSetores[setor]) return;
  // delete the key by setting to null
  await fetch(`${CAR_RTDB_URL}/${empresa}/GRUPOS_SETORES/${setor}.json`, { method: 'DELETE' });
}

// ---------- Multi-Setor (Grupo) ----------------------------------------

/**
 * Busca veículos de múltiplos setores. Retorna chave composta "SETOR/VEICULO".
 */
export async function fetchVeiculosMultiSetor(
  empresa: string,
  setores: string[]
): Promise<Record<string, CarVeiculo> | null> {
  const result: Record<string, CarVeiculo> = {};
  for (const setor of setores) {
    const veiculos = await rtdbGet<Record<string, CarVeiculo>>(`${empresa}/${setor}/veiculos`);
    if (veiculos) {
      for (const [key, v] of Object.entries(veiculos)) {
        if (v) result[`${setor}/${key}`] = v;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Busca veículos permitidos de múltiplos setores.
 */
export async function fetchVeiculosPermitidosMultiSetor(
  empresa: string,
  setores: string[],
  permitidos: string[]
): Promise<Record<string, CarVeiculo>> {
  const all = await fetchVeiculosMultiSetor(empresa, setores);
  if (!all) return {};
  return Object.fromEntries(
    Object.entries(all).filter(([, v]) => v && permitidos.includes(v.placa ?? ''))
  );
}

/**
 * Busca corridas de múltiplos setores. Retorna chave composta "SETOR/CORRIDA_ID".
 */
export async function fetchCorridasMultiSetor(
  empresa: string,
  setores: string[]
): Promise<Record<string, CarCorrida> | null> {
  const result: Record<string, CarCorrida> = {};
  for (const setor of setores) {
    const corridas = await rtdbGet<Record<string, CarCorrida>>(`${empresa}/${setor}/corridas`);
    if (corridas) {
      for (const [key, c] of Object.entries(corridas)) {
        if (c) result[`${setor}/${key}`] = c;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Busca agendamentos de múltiplos setores.
 */
export async function fetchAgendamentosMultiSetor(
  empresa: string,
  setores: string[]
): Promise<Record<string, Record<string, any>> | null> {
  const result: Record<string, Record<string, any>> = {};
  for (const setor of setores) {
    const agendamentos = await rtdbGet<Record<string, Record<string, any>>>(`${empresa}/${setor}/agendamentos`);
    if (agendamentos) {
      for (const [vKey, ags] of Object.entries(agendamentos)) {
        result[`${setor}/${vKey}`] = ags;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : null;
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

  // Resolve grupo de setores
  let grupo: string | undefined;
  let setoresGrupo: string[] | undefined;
  try {
    const grupoId = await rtdbGet<string>(`${empresa}/GRUPOS_SETORES/${setor}`);
    if (grupoId && typeof grupoId === 'string') {
      grupo = grupoId;
      // Encontra todos os setores que pertencem a este grupo
      const allSetoresGrupo = await rtdbGet<Record<string, string>>(`${empresa}/GRUPOS_SETORES`);
      if (allSetoresGrupo) {
        setoresGrupo = Object.entries(allSetoresGrupo)
          .filter(([, g]) => g === grupoId)
          .map(([s]) => s);
      }
    }
  } catch { /* grupo não configurado, segue sem grupo */ }

  const usuario: CarUsuario = {
    nome: userData.nome,
    mat: matricula,
    empresa,
    setor,
    role: userData.role,
    adm: userData.adm,
    op: userData.op,
    truck: userData.truck,
    em_corrida: userData.em_corrida,
    permitidos: userData.permitidos,
    grupo,
    setoresGrupo,
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

export async function cancelarAgendamento(
  empresa: string,
  setor: string,
  veiculoId: string,
  agendamentoId: string
): Promise<void> {
  return rtdbPatch(`${empresa}/${setor}/agendamentos/${veiculoId}/${agendamentoId}`, {
    status: 'cancelado',
  });
}

// ---------- Usuário ---------------------------------------------------

export async function updateUsuarioStatus(
  empresa: string,
  matricula: string,
  data: { em_corrida: boolean }
): Promise<void> {
  return rtdbPatch(`${empresa}/user/${matricula}`, data);
}

/** Troca a senha de um usuario do modulo Carro */
export async function trocarSenha(
  empresa: string,
  setor: string,
  matricula: string,
  novaSenha: string
): Promise<void> {
  // Verifica se o usuario existe
  const userData = await rtdbGet<CarUsuario & { pass?: string }>(
    `${empresa}/${setor}/users/${matricula}`
  );
  if (!userData) {
    throw new Error('Usuario nao encontrado.');
  }
  // Aplica a nova senha via PATCH (mantem os outros campos)
  await rtdbPatch(`${empresa}/${setor}/users/${matricula}`, {
    pass: novaSenha,
  });
}

/** Verifica se a senha do usuario e igual a matricula (senha padrao) */
export async function verificarSenhaPadrao(
  empresa: string,
  setor: string,
  matricula: string
): Promise<boolean> {
  const userData = await rtdbGet<CarUsuario & { pass?: string }>(
    `${empresa}/${setor}/users/${matricula}`
  );
  if (!userData || !userData.pass) return false;
  return userData.pass === matricula;
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

// ---------- Cartão de Abastecimento -----------------------------------

export type CartaoRecarga = {
  valor: number;
  data: string;
  hora: string;
  responsavel: string;
};

export type CartaoData = {
  saldo: number;
  recargas?: Record<string, CartaoRecarga>;
};

export async function fetchCartao(
  empresa: string,
  setor: string,
  veiculoId: string
): Promise<CartaoData | null> {
  return rtdbGet<CartaoData>(`${empresa}/${setor}/cartao/${encodeURIComponent(veiculoId)}`);
}

export async function fetchTodosCartoes(
  empresa: string,
  setor: string
): Promise<Record<string, CartaoData> | null> {
  return rtdbGet<Record<string, CartaoData>>(`${empresa}/${setor}/cartao`);
}

export async function registrarRecarga(
  empresa: string,
  setor: string,
  veiculoId: string,
  recarga: CartaoRecarga,
  saldoAtual: number
): Promise<void> {
  const agora = Date.now();
  const novoSaldo = saldoAtual + recarga.valor;
  // Salva a recarga e atualiza o saldo em paralelo
  await Promise.all([
    rtdbPut(
      `${empresa}/${setor}/cartao/${encodeURIComponent(veiculoId)}/recargas/${agora}`,
      recarga
    ),
    rtdbPatch(`${empresa}/${setor}/cartao/${encodeURIComponent(veiculoId)}`, {
      saldo: novoSaldo,
    }),
  ]);
}

export async function descontarSaldo(
  empresa: string,
  setor: string,
  veiculoId: string,
  valor: number
): Promise<number> {
  const cartao = await fetchCartao(empresa, setor, veiculoId);
  const saldoAtual = cartao?.saldo ?? 0;
  const novoSaldo = saldoAtual - valor;
  await rtdbPatch(`${empresa}/${setor}/cartao/${encodeURIComponent(veiculoId)}`, {
    saldo: novoSaldo,
  });
  return novoSaldo;
}
