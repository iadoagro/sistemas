// ============================================================================
// Acesso a dados e renderização de chamados
// ----------------------------------------------------------------------------
// Usado pelas páginas: abrir-chamado.html, chamados.html, painel-tecnico.html
// e chamado.html (detalhe). Todo o controle de permissão real acontece no
// banco (RLS + funções RPC) — este arquivo apenas chama a API do Supabase.
// ============================================================================

const SELECT_CHAMADO_COMPLETO = `
  *,
  tecnico:usuarios!chamados_tecnico_id_fkey(id,nome,telefone),
  aberto_por_usuario:usuarios!chamados_aberto_por_fkey(id,nome)
`;

/** Lista técnicos ativos, para popular selects de atribuição. */
async function listarTecnicosAtivos() {
  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('id, nome, telefone')
    .eq('perfil', 'tecnico')
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return data;
}

/** Cria um novo chamado (Suporte/Admin) via função RPC atômica. */
async function criarChamado(payload) {
  const { data, error } = await supabaseClient.rpc('criar_chamado', {
    p_titulo: payload.titulo,
    p_descricao: payload.descricao,
    p_cliente_nome: payload.clienteNome,
    p_cliente_contato: payload.clienteContato || null,
    p_endereco: payload.endereco || null,
    p_categoria: payload.categoria,
    p_prioridade: payload.prioridade,
    p_tecnico_id: payload.tecnicoId || null
  });
  if (error) throw error;
  return data; // id do chamado criado
}

/**
 * Lista chamados visíveis para o usuário atual (RLS decide o escopo),
 * com filtros opcionais de status, prioridade, técnico e busca textual.
 */
async function listarChamados(filtros = {}) {
  let query = supabaseClient
    .from('chamados')
    .select(SELECT_CHAMADO_COMPLETO)
    .order('criado_em', { ascending: false });

  if (filtros.status) query = query.eq('status', filtros.status);
  if (filtros.prioridade) query = query.eq('prioridade', filtros.prioridade);
  if (filtros.tecnicoId) query = query.eq('tecnico_id', filtros.tecnicoId);
  if (filtros.busca) {
    const termo = filtros.busca.trim();
    if (termo) {
      query = query.or(`titulo.ilike.%${termo}%,cliente_nome.ilike.%${termo}%,descricao.ilike.%${termo}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Busca um único chamado pelo id, com dados relacionados. */
async function buscarChamado(id) {
  const { data, error } = await supabaseClient
    .from('chamados')
    .select(SELECT_CHAMADO_COMPLETO)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Lista o histórico (auditoria) de um chamado, do mais antigo ao mais novo. */
async function listarHistorico(chamadoId) {
  const { data, error } = await supabaseClient
    .from('historico_chamados')
    .select('*, usuario:usuarios(nome)')
    .eq('chamado_id', chamadoId)
    .order('criado_em', { ascending: true });
  if (error) throw error;
  return data;
}

/** Atualiza o status de um chamado (Técnico dono, Suporte ou Admin). */
async function atualizarStatusChamado(chamadoId, novoStatus, comentario) {
  const { error } = await supabaseClient.rpc('atualizar_status_chamado', {
    p_chamado_id: chamadoId,
    p_novo_status: novoStatus,
    p_comentario: comentario || null
  });
  if (error) throw error;
}

/** Adiciona um comentário/observação técnica ao histórico do chamado. */
async function adicionarComentario(chamadoId, comentario) {
  const { error } = await supabaseClient.rpc('adicionar_comentario_chamado', {
    p_chamado_id: chamadoId,
    p_comentario: comentario
  });
  if (error) throw error;
}

/** Atribui (ou reatribui) um técnico a um chamado (Suporte/Admin). */
async function atribuirTecnico(chamadoId, tecnicoId) {
  const { error } = await supabaseClient.rpc('atribuir_tecnico', {
    p_chamado_id: chamadoId,
    p_tecnico_id: tecnicoId
  });
  if (error) throw error;
}

// ----------------------------------------------------------------------------
// Renderização
// ----------------------------------------------------------------------------

/** Renderiza uma tabela de chamados dentro de um container. */
function renderizarTabelaChamados(container, chamados, opcoes = {}) {
  if (!chamados || chamados.length === 0) {
    renderizarVazio(container, opcoes.mensagemVazia || 'Nenhum chamado encontrado.');
    return;
  }

  const mostrarTecnico = opcoes.mostrarTecnico !== false;

  const linhas = chamados.map(c => `
    <tr class="linha-chamado" data-id="${c.id}" tabindex="0">
      <td class="col-id">#${c.id}</td>
      <td>
        <div class="celula-titulo">${escaparHtml(c.titulo)}</div>
        <div class="celula-subtitulo">${escaparHtml(c.cliente_nome)}</div>
      </td>
      <td>${escaparHtml(ROTULOS_CATEGORIA[c.categoria] || c.categoria)}</td>
      ${mostrarTecnico ? `<td>${c.tecnico ? escaparHtml(c.tecnico.nome) : '<span class="texto-muted">Não atribuído</span>'}</td>` : ''}
      <td>${badgePrioridade(c.prioridade)}</td>
      <td>${badgeStatus(c.status)}</td>
      <td class="col-data">${formatarData(c.criado_em)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="tabela">
      <thead>
        <tr>
          <th>ID</th>
          <th>Chamado</th>
          <th>Categoria</th>
          ${mostrarTecnico ? '<th>Técnico</th>' : ''}
          <th>Prioridade</th>
          <th>Status</th>
          <th>Aberto em</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>`;

  container.querySelectorAll('.linha-chamado').forEach(linha => {
    const irParaDetalhe = () => { window.location.href = `chamado.html?id=${linha.dataset.id}`; };
    linha.addEventListener('click', irParaDetalhe);
    linha.addEventListener('keypress', (ev) => { if (ev.key === 'Enter') irParaDetalhe(); });
  });
}

/** Preenche um <select> com a lista de técnicos ativos. */
function preencherSelectTecnicos(select, tecnicos, { comOpcaoVazia = true } = {}) {
  select.innerHTML = '';
  if (comOpcaoVazia) {
    const opcao = document.createElement('option');
    opcao.value = '';
    opcao.textContent = 'Selecione um técnico...';
    select.appendChild(opcao);
  }
  tecnicos.forEach(t => {
    const opcao = document.createElement('option');
    opcao.value = t.id;
    opcao.textContent = t.nome;
    select.appendChild(opcao);
  });
}
