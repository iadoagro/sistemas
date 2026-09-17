// ============================================================================
// Configuração do Supabase
// ----------------------------------------------------------------------------
// Preencha SUPABASE_URL e SUPABASE_ANON_KEY com os valores do seu projeto
// (Supabase > Project Settings > API). A "anon key" é pública por natureza —
// a segurança real é garantida pelas políticas de RLS (veja sql/schema.sql).
//
// NUNCA coloque a "service_role key" aqui: este arquivo é publicado
// publicamente no GitHub Pages.
// ============================================================================

const SUPABASE_URL = 'https://fvzmjrzaktayyqpzoevq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_06dFm1j445AJsjsW7998og_Bm314_Yc';

// Domínio fictício usado para gerar o login a partir de nome + sobrenome
// (ver js/usuarios.js) e para completar o login na tela de entrada quando o
// usuário digita só a parte antes do "@" (ver login.html).
const DOMINIO_LOGIN_GERADO = 'sistema.local';

// Categorias e prioridades usadas em toda a aplicação (mantidas em um só
// lugar para evitar divergência entre telas).
const CATEGORIAS_CHAMADO = [
  { valor: 'sem_conexao', rotulo: 'Sem conexão' },
  { valor: 'lentidao', rotulo: 'Lentidão' },
  { valor: 'instalacao', rotulo: 'Instalação' },
  { valor: 'manutencao_rede', rotulo: 'Manutenção de rede' },
  { valor: 'outros', rotulo: 'Outros' }
];

const PRIORIDADES_CHAMADO = [
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'urgente', rotulo: 'Urgente' }
];

const STATUS_CHAMADO = [
  { valor: 'aberto', rotulo: 'Aberto' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'aguardando_peca', rotulo: 'Aguardando peça' },
  { valor: 'resolvido', rotulo: 'Resolvido' },
  { valor: 'fechado', rotulo: 'Fechado' }
];
