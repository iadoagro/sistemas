// ============================================================================
// Edge Function: resetar-senha
// ----------------------------------------------------------------------------
// Reseta a senha de outro usuário para a senha padrão ("123456") e marca a
// conta para forçar a troca no próximo login.
//
// Por que isso precisa ser uma Edge Function (e não código no frontend):
// trocar a senha de OUTRO usuário exige a "service_role key" do Supabase, que
// nunca pode ser exposta no frontend estático publicado no GitHub Pages —
// qualquer pessoa que abrisse o site teria acesso total ao banco. Aqui a
// service_role key fica só no servidor (variável de ambiente injetada
// automaticamente pelo Supabase), e a função confere que quem está chamando
// é um administrador ativo antes de fazer qualquer coisa.
//
// Deploy (pelo painel do Supabase, sem precisar da CLI):
//   1. Supabase Dashboard > Edge Functions > "Create a new function".
//   2. Nome: resetar-senha
//   3. Cole todo o conteúdo deste arquivo no editor e clique em "Deploy".
//   (As variáveis SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
//   já ficam disponíveis automaticamente — não precisa configurar nada.)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SENHA_PADRAO = '123456';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return respostaJson({ error: 'Não autenticado.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cliente "como o chamador" — usado só para descobrir quem está
    // chamando a função e confirmar que é um administrador ativo.
    const clienteChamador = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: erroUsuario } = await clienteChamador.auth.getUser();
    if (erroUsuario || !user) {
      return respostaJson({ error: 'Sessão inválida.' }, 401);
    }

    const { data: perfilChamador, error: erroPerfil } = await clienteChamador
      .from('usuarios')
      .select('perfil, ativo')
      .eq('id', user.id)
      .maybeSingle();

    if (erroPerfil || !perfilChamador || perfilChamador.perfil !== 'admin' || !perfilChamador.ativo) {
      return respostaJson({ error: 'Apenas administradores podem resetar senhas.' }, 403);
    }

    const { usuarioId } = await req.json();
    if (!usuarioId) {
      return respostaJson({ error: 'usuarioId é obrigatório.' }, 400);
    }

    // Cliente com privilégio total (service_role) — só a partir daqui, e só
    // depois de confirmado que o chamador é admin.
    const clienteAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { error: erroReset } = await clienteAdmin.auth.admin.updateUserById(usuarioId, {
      password: SENHA_PADRAO
    });
    if (erroReset) {
      return respostaJson({ error: erroReset.message }, 400);
    }

    const { error: erroFlag } = await clienteAdmin
      .from('usuarios')
      .update({ precisa_trocar_senha: true })
      .eq('id', usuarioId);
    if (erroFlag) {
      return respostaJson({ error: erroFlag.message }, 400);
    }

    return respostaJson({ ok: true });
  } catch (erro) {
    return respostaJson({ error: String(erro) }, 500);
  }
});
