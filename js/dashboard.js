// ============================================================================
// Dashboard administrativo — KPIs, gráficos simples e listagem geral
// ============================================================================

const CORES_STATUS = {
  aberto: '#2563EB',
  em_andamento: '#D97706',
  aguardando_peca: '#7C3AED',
  resolvido: '#16A34A',
  fechado: '#64748B'
};

const CORES_PRIORIDADE = {
  baixa: '#94A3B8',
  media: '#2563EB',
  alta: '#D97706',
  urgente: '#DC2626'
};

/** Busca todos os chamados visíveis (admin vê todos) com dados do técnico. */
async function carregarChamadosParaDashboard() {
  const { data, error } = await supabaseClient
    .from('chamados')
    .select('id, status, prioridade, criado_em, fechado_em, tecnico:usuarios!chamados_tecnico_id_fkey(id,nome)')
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data;
}

/** Calcula os indicadores (KPIs) a partir da lista completa de chamados. */
function calcularIndicadores(chamados) {
  const totais = { aberto: 0, em_andamento: 0, aguardando_peca: 0, resolvido: 0, fechado: 0 };
  const porPrioridade = { baixa: 0, media: 0, alta: 0, urgente: 0 };
  const porTecnico = new Map(); // id -> { nome, total, abertos }

  let somaHorasResolucao = 0;
  let quantidadeResolvidos = 0;

  chamados.forEach(c => {
    if (totais[c.status] !== undefined) totais[c.status]++;
    if (porPrioridade[c.prioridade] !== undefined) porPrioridade[c.prioridade]++;

    if (c.tecnico) {
      const atual = porTecnico.get(c.tecnico.id) || { nome: c.tecnico.nome, total: 0, abertos: 0 };
      atual.total++;
      if (!['resolvido', 'fechado'].includes(c.status)) atual.abertos++;
      porTecnico.set(c.tecnico.id, atual);
    }

    if (c.fechado_em) {
      const horas = (new Date(c.fechado_em) - new Date(c.criado_em)) / (1000 * 60 * 60);
      if (horas >= 0) {
        somaHorasResolucao += horas;
        quantidadeResolvidos++;
      }
    }
  });

  const tempoMedioHoras = quantidadeResolvidos > 0 ? somaHorasResolucao / quantidadeResolvidos : null;

  return {
    total: chamados.length,
    totais,
    porPrioridade,
    porTecnico: Array.from(porTecnico.values()).sort((a, b) => b.total - a.total),
    tempoMedioHoras
  };
}

function formatarTempoMedio(horas) {
  if (horas === null) return '—';
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} dias`;
}

/** Renderiza os cards de KPI no topo do dashboard. */
function renderizarKpis(container, indicadores) {
  const emAberto = indicadores.totais.aberto + indicadores.totais.em_andamento + indicadores.totais.aguardando_peca;

  const cards = [
    { rotulo: 'Total de chamados', valor: indicadores.total, icone: 'lista' },
    { rotulo: 'Em aberto', valor: emAberto, icone: 'relogio' },
    { rotulo: 'Fechados', valor: indicadores.totais.fechado, icone: 'check' },
    { rotulo: 'Tempo médio de resolução', valor: formatarTempoMedio(indicadores.tempoMedioHoras), icone: 'cronometro' }
  ];

  container.innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-icone">${iconeKpi(c.icone)}</div>
      <div>
        <div class="kpi-valor">${escaparHtml(String(c.valor))}</div>
        <div class="kpi-rotulo">${escaparHtml(c.rotulo)}</div>
      </div>
    </div>
  `).join('');
}

function iconeKpi(nome) {
  const icones = {
    lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    cronometro: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6M12 2v3"/>'
  };
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icones[nome] || ''}</svg>`;
}

/** Gera um gráfico de barras horizontais simples em SVG puro. */
function renderizarGraficoBarras(container, dados, cores, rotulos) {
  const entradas = Object.entries(dados);
  const maximo = Math.max(1, ...entradas.map(([, v]) => v));
  const alturaLinha = 34;
  const alturaSvg = entradas.length * alturaLinha + 10;
  const larguraArea = 180; // área máxima da barra em px (escala visual)

  const barras = entradas.map(([chave, valor], i) => {
    const y = i * alturaLinha + 10;
    const largura = (valor / maximo) * larguraArea;
    const cor = cores[chave] || '#94A3B8';
    const rotulo = (rotulos && rotulos[chave]) || chave;
    return `
      <text x="0" y="${y + 14}" class="grafico-rotulo">${escaparHtml(rotulo)}</text>
      <rect x="130" y="${y}" width="${largura}" height="20" rx="4" fill="${cor}"></rect>
      <text x="${130 + largura + 8}" y="${y + 14}" class="grafico-valor">${valor}</text>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 340 ${alturaSvg}" width="100%" height="${alturaSvg}" role="img" aria-label="Gráfico de barras">
      ${barras}
    </svg>`;
}

/** Renderiza a tabela de carga de trabalho por técnico. */
function renderizarCargaTecnicos(container, porTecnico) {
  if (porTecnico.length === 0) {
    renderizarVazio(container, 'Nenhum chamado atribuído a técnicos ainda.');
    return;
  }
  container.innerHTML = `
    <div class="tabela-wrap">
    <table class="tabela">
      <thead><tr><th>Técnico</th><th>Chamados em aberto</th><th>Total de chamados</th></tr></thead>
      <tbody>
        ${porTecnico.map(t => `
          <tr>
            <td>${escaparHtml(t.nome)}</td>
            <td>${t.abertos}</td>
            <td>${t.total}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>`;
}
