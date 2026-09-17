// ============================================================================
// Utilitários de interface — usados por todas as páginas
// ============================================================================

/** Escapa texto antes de inserir em innerHTML, evitando XSS. */
function escaparHtml(texto) {
  if (texto === null || texto === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(texto);
  return div.innerHTML;
}

/** Formata uma data ISO para o padrão brasileiro (dd/mm/aaaa hh:mm). */
function formatarData(isoString) {
  if (!isoString) return '—';
  const data = new Date(isoString);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

const ROTULOS_STATUS = Object.fromEntries(STATUS_CHAMADO.map(s => [s.valor, s.rotulo]));
const ROTULOS_PRIORIDADE = Object.fromEntries(PRIORIDADES_CHAMADO.map(p => [p.valor, p.rotulo]));
const ROTULOS_CATEGORIA = Object.fromEntries(CATEGORIAS_CHAMADO.map(c => [c.valor, c.rotulo]));

/** Retorna o HTML de uma pílula (badge) de status do chamado. */
function badgeStatus(status) {
  const rotulo = ROTULOS_STATUS[status] || status;
  return `<span class="badge badge-status-${escaparHtml(status)}">${escaparHtml(rotulo)}</span>`;
}

/** Retorna o HTML de uma pílula (badge) de prioridade do chamado. */
function badgePrioridade(prioridade) {
  const rotulo = ROTULOS_PRIORIDADE[prioridade] || prioridade;
  return `<span class="badge badge-prioridade-${escaparHtml(prioridade)}">${escaparHtml(rotulo)}</span>`;
}

/** Mostra uma notificação temporária (toast) no canto da tela. */
function mostrarToast(mensagem, tipo = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visivel'));

  setTimeout(() => {
    toast.classList.remove('toast-visivel');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function mostrarErro(mensagem) {
  mostrarToast(mensagem, 'erro');
}

function mostrarSucesso(mensagem) {
  mostrarToast(mensagem, 'sucesso');
}

/**
 * Traduz erros comuns do Supabase/rede para mensagens amigáveis em
 * português. Recebe o objeto de erro (ou string) e devolve uma mensagem.
 */
function traduzirErro(erro) {
  const msg = (erro && erro.message) ? erro.message : String(erro || 'Erro desconhecido');

  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (msg.includes('Email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  if (msg.includes('User already registered')) return 'Já existe um usuário cadastrado com este e-mail.';
  if (msg.includes('email rate limit exceeded')) {
    return 'Limite de envio de e-mail do Supabase atingido. Desative "Confirm email" em Authentication > Providers > Email para evitar esse limite (os logins gerados não são e-mails reais).';
  }
  if (msg.includes('violates foreign key constraint') && msg.includes('chamados')) {
    return 'Não é possível excluir este usuário porque ele está vinculado a chamados existentes (como técnico ou como quem abriu o chamado). Use "Desativar" em vez de excluir.';
  }
  if (msg.includes('clientes_cpf_key') || (msg.includes('duplicate key') && msg.includes('clientes') && msg.includes('cpf'))) {
    return 'Já existe um cliente cadastrado com este CPF.';
  }
  if (msg.includes('clientes_cpf_check')) {
    return 'CPF inválido. Digite os 11 números do CPF.';
  }
  if (msg.includes('tipos_problema_nome_key')) {
    return 'Já existe um tipo de problema com este nome.';
  }
  if (msg.includes('tipos_servico_nome_key')) {
    return 'Já existe um tipo de serviço com este nome.';
  }
  if (msg.includes('duplicate key') && msg.includes('usuarios_email_key')) {
    return 'Já existe um usuário com este login.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
  }
  if (msg.includes('JWT') || msg.includes('session')) return 'Sua sessão expirou. Faça login novamente.';
  return msg;
}

/** Exibe/oculta um indicador de carregamento dentro de um elemento. */
function definirCarregando(elemento, carregando, textoCarregando = 'Carregando...') {
  if (!elemento) return;
  if (carregando) {
    elemento.dataset.textoOriginal = elemento.dataset.textoOriginal || elemento.innerHTML;
    elemento.disabled = true;
    elemento.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${escaparHtml(textoCarregando)}`;
  } else {
    elemento.disabled = false;
    if (elemento.dataset.textoOriginal) {
      elemento.innerHTML = elemento.dataset.textoOriginal;
    }
  }
}

/** Renderiza um estado vazio padronizado dentro de um container. */
function renderizarVazio(container, mensagem) {
  container.innerHTML = `
    <div class="estado-vazio">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 13h6m-6 4h6M9 9h1M5 21h14a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0015.586 2H5a2 2 0 00-2 2v15a2 2 0 002 2z"/>
      </svg>
      <p>${escaparHtml(mensagem)}</p>
    </div>`;
}

/** Modal de confirmação simples, devolve uma Promise<boolean>. */
function confirmarAcao(mensagem, tituloBotao = 'Confirmar') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-caixa" role="dialog" aria-modal="true">
        <p class="modal-mensagem">${escaparHtml(mensagem)}</p>
        <div class="modal-acoes">
          <button type="button" class="botao botao-secundario" data-acao="cancelar">Cancelar</button>
          <button type="button" class="botao botao-perigo" data-acao="confirmar">${escaparHtml(tituloBotao)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (ev) => {
      const acao = ev.target?.dataset?.acao;
      if (acao === 'confirmar') {
        overlay.remove();
        resolve(true);
      } else if (acao === 'cancelar' || ev.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

const ICONES_SIDEBAR = {
  dashboard: '<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
  chamados: '<path d="M9 13h6m-6 4h6M9 9h1M5 21h14a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0015.586 2H5a2 2 0 00-2 2v15a2 2 0 002 2z"/>',
  'abrir-chamado': '<path d="M12 5v14m-7-7h14"/>',
  'painel-tecnico': '<path d="M9 13h6m-6 4h6M9 9h1M5 21h14a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0015.586 2H5a2 2 0 00-2 2v15a2 2 0 002 2z"/>',
  cadastros: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>'
};

/** Renderiza o menu lateral de acordo com o perfil do usuário logado. */
function renderizarNavbar(usuario, paginaAtiva) {
  return renderizarSidebar(usuario, paginaAtiva);
}

function renderizarSidebar(usuario, paginaAtiva) {
  const destino = document.getElementById('sidebar');
  if (!destino || !usuario) return;

  const links = [];
  if (usuario.perfil === 'admin') {
    links.push({ href: 'dashboard.html', rotulo: 'Dashboard', id: 'dashboard' });
    links.push({ href: 'chamados.html', rotulo: 'Chamados', id: 'chamados' });
    links.push({ href: 'abrir-chamado.html', rotulo: 'Abrir chamado', id: 'abrir-chamado' });
    links.push({ href: 'cadastros.html', rotulo: 'Cadastros', id: 'cadastros' });
  } else if (usuario.perfil === 'suporte') {
    links.push({ href: 'chamados.html', rotulo: 'Chamados', id: 'chamados' });
    links.push({ href: 'abrir-chamado.html', rotulo: 'Abrir chamado', id: 'abrir-chamado' });
    links.push({ href: 'cadastros.html', rotulo: 'Cadastros', id: 'cadastros' });
  } else if (usuario.perfil === 'tecnico') {
    links.push({ href: 'painel-tecnico.html', rotulo: 'Meus chamados', id: 'painel-tecnico' });
  }

  const linksHtml = links.map(l => `
    <a href="${l.href}" class="sidebar-link ${l.id === paginaAtiva ? 'sidebar-link-ativo' : ''}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ICONES_SIDEBAR[l.id] || ''}</svg>
      ${escaparHtml(l.rotulo)}
    </a>
  `).join('');

  destino.innerHTML = `
    <div class="sidebar-marca">
      <span class="sidebar-logo" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
        </svg>
      </span>
      Sistema
    </div>
    <nav class="sidebar-links">${linksHtml}</nav>
    <div class="sidebar-rodape">
      <div class="sidebar-usuario">
        <span class="sidebar-usuario-nome">${escaparHtml(usuario.nome)}</span>
        <span class="badge badge-perfil-${escaparHtml(usuario.perfil)}">${escaparHtml(rotuloPerfil(usuario.perfil))}</span>
      </div>
      <button type="button" id="botao-sair" class="botao botao-secundario botao-pequeno botao-bloco">Sair</button>
    </div>`;

  document.getElementById('botao-sair').addEventListener('click', async () => {
    const ok = await confirmarAcao('Deseja realmente sair do sistema?', 'Sair');
    if (ok) fazerLogout();
  });

  const overlay = document.getElementById('sidebar-overlay');
  const botaoMenu = document.getElementById('botao-menu-mobile');
  const fecharMenu = () => document.body.classList.remove('sidebar-aberta');
  if (botaoMenu) {
    botaoMenu.addEventListener('click', () => document.body.classList.toggle('sidebar-aberta'));
  }
  if (overlay) {
    overlay.addEventListener('click', fecharMenu);
  }
  destino.querySelectorAll('.sidebar-link').forEach(link => link.addEventListener('click', fecharMenu));
}

function rotuloPerfil(perfil) {
  return { admin: 'Administrador', suporte: 'Suporte', tecnico: 'Técnico' }[perfil] || perfil;
}

/**
 * Liga o comportamento de um grupo de abas: botões com [data-aba] alternam
 * a visibilidade dos painéis com o id correspondente, e disparam
 * onAtivar(id) na primeira vez que cada aba é aberta (para lazy-load).
 */
function inicializarAbas(containerBotoes, { onAtivar } = {}) {
  const jaAtivadas = new Set();
  const botoes = Array.from(containerBotoes.querySelectorAll('[data-aba]'));

  function ativar(id) {
    botoes.forEach(b => b.classList.toggle('aba-botao-ativa', b.dataset.aba === id));
    document.querySelectorAll('.aba-painel').forEach(p => {
      p.classList.toggle('aba-painel-ativo', p.id === `aba-${id}`);
    });
    if (!jaAtivadas.has(id)) {
      jaAtivadas.add(id);
      if (onAtivar) onAtivar(id);
    }
  }

  botoes.forEach(b => b.addEventListener('click', () => ativar(b.dataset.aba)));

  return { ativar };
}
