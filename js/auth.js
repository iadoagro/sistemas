// ============================================================================
// Autenticação e controle de acesso por perfil
// ============================================================================

const PAGINA_POR_PERFIL = {
  admin: 'dashboard.html',
  suporte: 'chamados.html',
  tecnico: 'painel-tecnico.html'
};

/** Efetua login com e-mail/senha via Supabase Auth. */
async function fazerLogin(email, senha) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

/** Encerra a sessão atual e redireciona para a tela de login. */
async function fazerLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

/**
 * Busca o registro de perfil (tabela usuarios) do usuário autenticado no
 * momento. Retorna null se não houver sessão ou se o registro não existir.
 */
async function buscarPerfilLogado() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('id, nome, email, perfil, telefone, ativo, precisa_trocar_senha')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/** Nome do arquivo HTML atual (ex: "chamado.html"), sem querystring. */
function nomePaginaAtual() {
  return window.location.pathname.split('/').pop() || 'index.html';
}

/**
 * Protege uma página: garante que existe sessão válida, que o perfil está
 * ativo e que o perfil tem permissão para ver esta página. Caso contrário,
 * redireciona. Deve ser chamada no topo de cada página protegida e o
 * resultado (usuário) usado para renderizar a navbar/conteúdo.
 *
 * @param {string[]} perfisPermitidos - ex: ['admin', 'suporte']
 * @returns {Promise<object|null>} o usuário logado, ou null se redirecionou
 */
async function exigirAutenticacao(perfisPermitidos) {
  const usuario = await buscarPerfilLogado();

  if (!usuario) {
    window.location.href = 'login.html';
    return null;
  }

  if (!usuario.ativo) {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html?erro=inativo';
    return null;
  }

  if (usuario.precisa_trocar_senha && nomePaginaAtual() !== 'trocar-senha.html') {
    window.location.href = 'trocar-senha.html';
    return null;
  }

  if (perfisPermitidos && !perfisPermitidos.includes(usuario.perfil)) {
    window.location.href = PAGINA_POR_PERFIL[usuario.perfil] || 'login.html';
    return null;
  }

  return usuario;
}

/** Usado em index.html/login.html para redirecionar quem já está logado. */
async function redirecionarSeLogado() {
  const usuario = await buscarPerfilLogado();
  if (usuario && usuario.ativo) {
    window.location.href = usuario.precisa_trocar_senha
      ? 'trocar-senha.html'
      : (PAGINA_POR_PERFIL[usuario.perfil] || 'login.html');
    return true;
  }
  return false;
}
