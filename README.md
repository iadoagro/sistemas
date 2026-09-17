# Sistema

Sistema web para abertura e gerenciamento de chamados de suporte técnico de
uma provedora de internet via fibra óptica. Frontend 100% estático (HTML,
CSS e JavaScript puro), pronto para publicar no GitHub Pages, com
persistência de dados via [Supabase](https://supabase.com) (Auth + Postgres
+ Row Level Security).

## Estrutura de arquivos

```
sistemas/
├── index.html            # Ponto de entrada: redireciona para login ou para a área do usuário
├── login.html             # Tela de login única
├── trocar-senha.html      # Troca de senha (forçada no 1º acesso, ou voluntária)
├── abrir-chamado.html     # Abertura de chamado (Suporte/Admin)
├── chamados.html          # Lista/filtro de chamados (Suporte/Admin)
├── painel-tecnico.html    # "Meus chamados" (Técnico)
├── chamado.html           # Detalhe do chamado: histórico, status, comentários, atribuição
├── dashboard.html         # Dashboard administrativo com KPIs e gráficos (Admin)
├── usuarios.html          # Gerenciamento de usuários (Admin)
├── css/
│   └── estilo.css
├── js/
│   ├── config.js           # URL, anon key e domínio de login do Supabase (edite aqui)
│   ├── supabaseClient.js   # Instancia o client oficial @supabase/supabase-js
│   ├── ui.js                # Toasts, modais, navbar, badges, formatação
│   ├── auth.js               # Login/logout e proteção de páginas por perfil
│   ├── chamados.js            # CRUD de chamados + histórico
│   ├── dashboard.js           # Cálculo de KPIs e gráficos do dashboard
│   └── usuarios.js            # CRUD de usuários (Admin): criar, editar, excluir, resetar senha
├── supabase/
│   └── functions/
│       └── resetar-senha/  # Edge Function: reseta a senha de outro usuário (ver seção própria)
│           └── index.ts
└── sql/
    └── schema.sql          # Tabelas, políticas de RLS e funções RPC
```

## 1. Configurar o projeto Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, cole e execute o conteúdo de [`sql/schema.sql`](sql/schema.sql).
   Isso cria as tabelas `usuarios`, `chamados`, `historico_chamados`, as
   políticas de Row Level Security e as funções RPC usadas pelo app.
3. Em **Authentication > Providers > Email**, **desative "Confirm email"**.
   Isso é obrigatório (não apenas recomendado): os logins dos usuários de
   Suporte/Técnico são gerados automaticamente a partir do nome
   (`nome.sobrenome@sistema.local`) e não são e-mails reais capazes de
   receber confirmação. Com "Confirm email" ligado, o cadastro falha ou
   estoura o limite de envio de e-mail do Supabase (`email rate limit
   exceeded`).
4. Crie o **primeiro administrador**:
   - Vá em **Authentication > Users > Add user**, informe e-mail/senha e
     marque "Auto Confirm User".
   - Copie o UID gerado.
   - No **SQL Editor**, rode (substituindo os valores):
     ```sql
     insert into public.usuarios (id, nome, email, perfil, ativo)
     values ('COLE-O-UID-AQUI', 'Nome do Admin', 'admin@empresa.com', 'admin', true);
     ```
   - A partir daí, esse administrador pode cadastrar os demais usuários
     (Suporte e Técnico) pela própria tela **Usuários** do sistema — só
     preenchendo nome e sobrenome (login e senha inicial são automáticos,
     veja a seção abaixo).
5. **Deploy da Edge Function `resetar-senha`** (usada pelo botão "Resetar
   senha" da tela Usuários):
   - No painel do Supabase, vá em **Edge Functions > Create a new function**.
   - Nome da função: `resetar-senha`.
   - Cole o conteúdo de [`supabase/functions/resetar-senha/index.ts`](supabase/functions/resetar-senha/index.ts)
     no editor e clique em **Deploy**.
   - Não é preciso configurar variáveis de ambiente: `SUPABASE_URL`,
     `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já ficam disponíveis
     automaticamente dentro de toda Edge Function do projeto.

## 2. Configurar a anon key no frontend

Edite [`js/config.js`](js/config.js) e preencha:

```js
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA-ANON-KEY-AQUI';
```

Esses valores estão em **Project Settings > API** no painel do Supabase.
A `anon key` é pública por design — a segurança de fato vem das políticas de
RLS definidas em `sql/schema.sql`. **Nunca** coloque a `service_role key`
neste arquivo, pois ele fica publicamente acessível no GitHub Pages.

## 3. Publicar no GitHub Pages

1. Suba esta pasta para um repositório no GitHub.
2. Em **Settings > Pages**, selecione a branch (ex: `main`) e a pasta raiz (`/`).
3. Acesse a URL gerada pelo GitHub Pages — o `index.html` cuida do
   redirecionamento para a tela de login.

Nenhum passo de build é necessário: todos os arquivos são estáticos e os
únicos scripts externos vêm de CDN (`@supabase/supabase-js` e a fonte Inter
do Google Fonts).

## Perfis e permissões

| Perfil     | Pode                                                                 |
|------------|-----------------------------------------------------------------------|
| Suporte    | Abrir chamados, atribuir/reatribuir técnico, acompanhar todos os chamados |
| Técnico    | Ver apenas os chamados atribuídos a ele, atualizar status, adicionar comentários |
| Admin      | Tudo o que Suporte e Técnico fazem, além de gerenciar usuários e ver o dashboard |

Essas regras são reforçadas tanto na interface quanto no banco de dados via
Row Level Security — mesmo que alguém tente chamar a API do Supabase
diretamente, as políticas em `sql/schema.sql` impedem acesso fora do escopo
do perfil.

## Sobre a criação, exclusão e senha de usuários (limitações do frontend estático)

**Criação:** o admin preenche só nome e sobrenome na tela **Usuários**. O
login é gerado automaticamente (`nome.sobrenome@sistema.local`, com um
número no final em caso de repetição) e a senha inicial é sempre `123456`
— a conta fica marcada para forçar a troca de senha no primeiro acesso
(tela `trocar-senha.html`). Na tela de login, o usuário pode digitar só a
parte antes do "@" (ex: `joao.silva`) que o domínio é completado
automaticamente. Por baixo dos panos, isso usa `supabase.auth.signUp()` a
partir de um cliente Supabase temporário e isolado (sem persistir sessão),
para não substituir a sessão do administrador logado.

**Exclusão:** o botão "Excluir" apaga de vez o registro do usuário
(`public.usuarios`). Se o usuário já estiver vinculado a algum chamado
(como técnico ou como quem abriu), o banco recusa a exclusão — nesse caso,
use "Desativar" em vez de excluir. Excluir remove o acesso e a listagem,
mas não apaga a conta de autenticação (`auth.users`) em si; para liberar o
mesmo login depois, remova-a manualmente em **Authentication > Users** no
painel do Supabase.

**Resetar senha:** trocar a senha de **outro** usuário (diferente do que
está logado) exige privilégio de administrador do Supabase — a
`service_role key`, que nunca pode ficar no frontend estático publicado no
GitHub Pages. Por isso o botão "Resetar senha" chama a Edge Function
`supabase/functions/resetar-senha` (rodando no Supabase, não no navegador):
ela confere que quem chamou é um admin ativo e só então redefine a senha do
usuário-alvo para `123456`, marcando a conta para forçar a troca no próximo
login.

## Categorias, prioridades e status de chamado

Definidos em [`js/config.js`](js/config.js):

- **Categoria:** Sem conexão, Lentidão, Instalação, Manutenção de rede, Outros
- **Prioridade:** Baixa, Média, Alta, Urgente
- **Status:** Aberto, Em andamento, Aguardando peça, Resolvido, Fechado
# sistemas
