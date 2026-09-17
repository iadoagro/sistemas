// ============================================================================
// Cliente Supabase
// ----------------------------------------------------------------------------
// Carrega o SDK oficial via CDN (ver <script> nas páginas HTML, que precisa
// vir ANTES deste arquivo) e expõe uma instância única (singleton) usada por
// toda a aplicação, além de uma fábrica de clientes "descartáveis" usada
// apenas pela tela de administração de usuários.
// ============================================================================

// `supabase` global vem do script da CDN:
// https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'sistema-auth'
  }
});

/**
 * Cria um cliente Supabase temporário, com sessão apenas em memória
 * (persistSession: false). Usado pelo administrador para criar novos
 * usuários via auth.signUp() sem substituir a própria sessão logada,
 * já que o projeto não expõe (nem deve expor) a service_role key no
 * frontend estático hospedado no GitHub Pages.
 */
function criarClienteTemporario() {
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
