// ============================================================================
// Acesso a dados — Cadastros (Clientes, Tipos de Problema, Tipos de Serviço)
// ----------------------------------------------------------------------------
// Usado pela página cadastros.html. Todo o controle de permissão real
// acontece no banco (RLS) — este arquivo apenas chama a API do Supabase.
// ============================================================================

/** Remove tudo que não for dígito (usado para normalizar CPF antes de salvar). */
function apenasDigitos(texto) {
  return (texto || '').replace(/\D/g, '');
}

/** Formata 11 dígitos como CPF (000.000.000-00) para exibição. */
function formatarCpf(cpf) {
  const d = apenasDigitos(cpf);
  if (d.length !== 11) return cpf || '—';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

/** Lista clientes, mais recentes primeiro, com busca opcional por nome/CPF. */
async function listarClientes(busca) {
  let query = supabaseClient
    .from('clientes')
    .select('id, nome, cpf, bairro, plano, ativo, criado_em')
    .order('criado_em', { ascending: false });

  const termo = (busca || '').trim();
  if (termo) {
    query = query.or(`nome.ilike.%${termo}%,cpf.ilike.%${apenasDigitos(termo)}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function criarCliente({ nome, cpf, bairro, plano }) {
  const { error } = await supabaseClient
    .from('clientes')
    .insert({ nome, cpf: apenasDigitos(cpf), bairro: bairro || null, plano: plano || null });
  if (error) throw error;
}

async function atualizarCliente(id, { nome, cpf, bairro, plano }) {
  const { error } = await supabaseClient
    .from('clientes')
    .update({ nome, cpf: apenasDigitos(cpf), bairro: bairro || null, plano: plano || null })
    .eq('id', id);
  if (error) throw error;
}

async function definirAtivoCliente(id, ativo) {
  const { error } = await supabaseClient.from('clientes').update({ ativo }).eq('id', id);
  if (error) throw error;
}

async function excluirCliente(id) {
  const { error } = await supabaseClient.from('clientes').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Tipos de problema / Tipos de serviço
// ----------------------------------------------------------------------------
// As duas listas têm o mesmo formato (nome + ativo), então usamos as mesmas
// funções genéricas apontando para a tabela correspondente.
// ---------------------------------------------------------------------------

async function listarTipos(tabela) {
  const { data, error } = await supabaseClient
    .from(tabela)
    .select('id, nome, ativo, criado_em')
    .order('nome');
  if (error) throw error;
  return data;
}

async function criarTipo(tabela, nome) {
  const { error } = await supabaseClient.from(tabela).insert({ nome });
  if (error) throw error;
}

async function atualizarTipo(tabela, id, nome) {
  const { error } = await supabaseClient.from(tabela).update({ nome }).eq('id', id);
  if (error) throw error;
}

async function definirAtivoTipo(tabela, id, ativo) {
  const { error } = await supabaseClient.from(tabela).update({ ativo }).eq('id', id);
  if (error) throw error;
}

async function excluirTipo(tabela, id) {
  const { error } = await supabaseClient.from(tabela).delete().eq('id', id);
  if (error) throw error;
}
