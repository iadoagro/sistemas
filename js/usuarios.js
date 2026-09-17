// ============================================================================
// Gerenciamento de usuários (somente Administrador)
// ============================================================================

/** Senha padrão atribuída a todo usuário criado pelo administrador. */
const SENHA_PADRAO_NOVO_USUARIO = '123456';

// DOMINIO_LOGIN_GERADO vem de js/config.js (compartilhado com login.html).

/** Lista todos os usuários cadastrados, mais recentes primeiro. */
async function listarUsuarios() {
  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('id, nome, email, perfil, telefone, ativo, precisa_trocar_senha, criado_em')
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data;
}

/** Remove acentos, espaços e caracteres especiais, deixando só a-z0-9. */
function normalizarParaLogin(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

async function loginJaExiste(email) {
  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Gera um login único a partir do nome e sobrenome, no formato
 * "nome.sobrenome@sistema.local" (acrescentando um número no final em caso
 * de repetição). Esse "e-mail" nunca é usado para enviar mensagens — é só o
 * identificador de login exigido pelo Supabase Auth.
 */
async function gerarLoginUnico(nome, sobrenome) {
  const base = `${normalizarParaLogin(nome)}.${normalizarParaLogin(sobrenome)}`;
  let candidato = `${base}@${DOMINIO_LOGIN_GERADO}`;
  let sufixo = 1;
  while (await loginJaExiste(candidato)) {
    sufixo++;
    candidato = `${base}${sufixo}@${DOMINIO_LOGIN_GERADO}`;
  }
  return candidato;
}

/**
 * Cria um novo usuário (Suporte ou Técnico) a partir de nome + sobrenome.
 * O login é gerado automaticamente, a senha inicial é sempre
 * "123456" e a conta fica marcada para forçar a troca de senha no
 * primeiro acesso (tela trocar-senha.html).
 *
 * Como o frontend é 100% estático (GitHub Pages) e não pode expor a
 * "service_role key" do Supabase, usamos um cliente temporário e isolado
 * (persistSession: false) para chamar auth.signUp(). Isso cria a conta de
 * autenticação sem nunca substituir a sessão do administrador logado.
 * Em seguida, gravamos o perfil na tabela "usuarios" usando a sessão real
 * do administrador (que tem permissão via RLS).
 *
 * Importante: o projeto Supabase precisa estar com Authentication >
 * Providers > Email > "Confirm email" DESATIVADO, já que "nome.sobrenome@
 * sistema.local" não é um e-mail real capaz de receber confirmação.
 */
async function criarUsuario({ nome, sobrenome, perfil, telefone }) {
  const nomeCompleto = `${nome} ${sobrenome}`.trim();
  const email = await gerarLoginUnico(nome, sobrenome);

  const clienteTemp = criarClienteTemporario();

  const { data: dadosCadastro, error: erroCadastro } = await clienteTemp.auth.signUp({
    email,
    password: SENHA_PADRAO_NOVO_USUARIO
  });
  if (erroCadastro) throw erroCadastro;

  const novoId = dadosCadastro.user?.id;
  if (!novoId) {
    throw new Error('Não foi possível criar a conta de autenticação. Tente novamente.');
  }

  const { error: erroPerfil } = await supabaseClient
    .from('usuarios')
    .insert({
      id: novoId,
      nome: nomeCompleto,
      email,
      perfil,
      telefone: telefone || null,
      ativo: true,
      precisa_trocar_senha: true
    });

  if (erroPerfil) throw erroPerfil;

  return { id: novoId, login: email, senha: SENHA_PADRAO_NOVO_USUARIO };
}

/** Atualiza nome, telefone e (se admin) perfil/status ativo de um usuário. */
async function atualizarUsuario(id, dados) {
  const { error } = await supabaseClient
    .from('usuarios')
    .update(dados)
    .eq('id', id);
  if (error) throw error;
}

/**
 * "Remove" um usuário do sistema. Como excluir a conta de autenticação
 * exige a service_role key (indisponível no frontend), a remoção real é uma
 * desativação (ativo = false): a política de RLS bloqueia imediatamente
 * qualquer acesso desse usuário aos dados do sistema. Para excluir
 * definitivamente a conta de autenticação, use o painel do Supabase
 * (Authentication > Users).
 */
async function desativarUsuario(id) {
  await atualizarUsuario(id, { ativo: false });
}

async function reativarUsuario(id) {
  await atualizarUsuario(id, { ativo: true });
}

/**
 * Exclui definitivamente o perfil do usuário (linha em public.usuarios).
 *
 * Só é permitido quando o usuário não está referenciado em nenhum chamado
 * (como técnico responsável ou como quem abriu o chamado) — o banco recusa a
 * exclusão nesse caso (chave estrangeira), e a mensagem é traduzida em
 * traduzirErro() para orientar a usar "Desativar" em vez de excluir.
 *
 * Isso remove o acesso e o registro do usuário na lista do sistema, mas não
 * apaga a conta de autenticação em si (auth.users) — como excluir contas de
 * autenticação exige a service_role key, que não pode ficar no frontend
 * estático, essa limpeza final precisa ser feita pelo painel do Supabase
 * (Authentication > Users), se você quiser liberar o mesmo login depois.
 */
async function excluirUsuario(id) {
  const { error } = await supabaseClient
    .from('usuarios')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * Reseta a senha de outro usuário para a senha padrão ("123456") e marca a
 * conta para forçar a troca no próximo login.
 *
 * Trocar a senha de outra pessoa exige privilégio de administrador do
 * Supabase (service_role key), que não pode existir no frontend estático.
 * Por isso essa operação roda numa Edge Function (supabase/functions/
 * resetar-senha) — este código só invoca a função, já autenticado como o
 * admin logado; a function confere de novo, no servidor, que quem chamou é
 * realmente um admin antes de fazer qualquer coisa.
 */
async function resetarSenhaUsuario(id) {
  const { data, error } = await supabaseClient.functions.invoke('resetar-senha', {
    body: { usuarioId: id }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return true;
}
