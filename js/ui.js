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

/** Renderiza a barra de navegação de acordo com o perfil do usuário logado. */
function renderizarNavbar(usuario, paginaAtiva) {
  const destino = document.getElementById('navbar');
  if (!destino || !usuario) return;

  const links = [];
  if (usuario.perfil === 'admin') {
    links.push({ href: 'dashboard.html', rotulo: 'Dashboard', id: 'dashboard' });
    links.push({ href: 'chamados.html', rotulo: 'Chamados', id: 'chamados' });
    links.push({ href: 'abrir-chamado.html', rotulo: 'Abrir chamado', id: 'abrir-chamado' });
    links.push({ href: 'usuarios.html', rotulo: 'Usuários', id: 'usuarios' });
  } else if (usuario.perfil === 'suporte') {
    links.push({ href: 'chamados.html', rotulo: 'Chamados', id: 'chamados' });
    links.push({ href: 'abrir-chamado.html', rotulo: 'Abrir chamado', id: 'abrir-chamado' });
  } else if (usuario.perfil === 'tecnico') {
    links.push({ href: 'painel-tecnico.html', rotulo: 'Meus chamados', id: 'painel-tecnico' });
  }

  const linksHtml = links.map(l => `
    <a href="${l.href}" class="navbar-link ${l.id === paginaAtiva ? 'navbar-link-ativo' : ''}">${escaparHtml(l.rotulo)}</a>
  `).join('');

  destino.innerHTML = `
    <div class="navbar-conteudo">
      <div class="navbar-marca">
        <span class="navbar-logo" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
          </svg>
        </span>
        Sistema
      </div>
      <nav class="navbar-links">${linksHtml}</nav>
      <div class="navbar-usuario">
        <span class="navbar-usuario-nome">${escaparHtml(usuario.nome)}</span>
        <span class="badge badge-perfil-${escaparHtml(usuario.perfil)}">${escaparHtml(rotuloPerfil(usuario.perfil))}</span>
        <button type="button" id="botao-sair" class="botao botao-secundario botao-pequeno">Sair</button>
      </div>
      <button type="button" id="botao-menu-mobile" class="navbar-menu-mobile" aria-label="Abrir menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
    </div>`;

  document.getElementById('botao-sair').addEventListener('click', async () => {
    const ok = await confirmarAcao('Deseja realmente sair do sistema?', 'Sair');
    if (ok) fazerLogout();
  });

  const botaoMenu = document.getElementById('botao-menu-mobile');
  botaoMenu.addEventListener('click', () => {
    destino.classList.toggle('navbar-aberta');
  });
}

function rotuloPerfil(perfil) {
  return { admin: 'Administrador', suporte: 'Suporte', tecnico: 'Técnico' }[perfil] || perfil;
}
