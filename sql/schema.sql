-- ============================================================================
-- Sistema — schema e políticas de RLS (Supabase / PostgreSQL)
-- ============================================================================
-- Como aplicar:
--   1. Abra o projeto no painel do Supabase.
--   2. Vá em "SQL Editor" > "New query".
--   3. Cole este arquivo inteiro e clique em "Run".
--   4. Depois, crie o primeiro usuário administrador (veja instruções no
--      final deste arquivo, seção "BOOTSTRAP DO PRIMEIRO ADMIN").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABELAS
-- ----------------------------------------------------------------------------

create table if not exists public.usuarios (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nome                  text not null,
  email                 text not null unique,
  perfil                text not null check (perfil in ('admin', 'suporte', 'tecnico')),
  telefone              text,
  ativo                 boolean not null default true,
  precisa_trocar_senha  boolean not null default false,
  criado_em             timestamptz not null default now()
);

-- Migração incremental (caso a tabela já exista de uma instalação anterior):
alter table public.usuarios
  add column if not exists precisa_trocar_senha boolean not null default false;

comment on table public.usuarios is 'Perfil de cada usuário autenticado (admin, suporte ou técnico).';

create table if not exists public.chamados (
  id                bigint generated always as identity primary key,
  titulo            text not null,
  descricao         text not null,
  cliente_nome      text not null,
  cliente_contato   text,
  endereco          text,
  categoria         text not null check (
                      categoria in ('sem_conexao', 'lentidao', 'instalacao', 'manutencao_rede', 'outros')
                    ),
  prioridade        text not null check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  status            text not null default 'aberto' check (
                      status in ('aberto', 'em_andamento', 'aguardando_peca', 'resolvido', 'fechado')
                    ),
  tecnico_id        uuid references public.usuarios (id),
  aberto_por        uuid not null references public.usuarios (id),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  fechado_em        timestamptz
);

comment on table public.chamados is 'Chamados de suporte técnico abertos pela equipe de suporte.';

create table if not exists public.historico_chamados (
  id          bigint generated always as identity primary key,
  chamado_id  bigint not null references public.chamados (id) on delete cascade,
  usuario_id  uuid references public.usuarios (id),
  tipo        text not null check (tipo in ('criacao', 'status', 'comentario', 'atribuicao')),
  descricao   text not null,
  criado_em   timestamptz not null default now()
);

comment on table public.historico_chamados is 'Auditoria: cada mudança de status, atribuição ou comentário de um chamado.';

create index if not exists idx_chamados_tecnico_id on public.chamados (tecnico_id);
create index if not exists idx_chamados_status on public.chamados (status);
create index if not exists idx_chamados_aberto_por on public.chamados (aberto_por);
create index if not exists idx_historico_chamado_id on public.historico_chamados (chamado_id);

-- ----------------------------------------------------------------------------
-- 2. FUNÇÕES AUXILIARES (SECURITY DEFINER — evitam recursão de RLS)
-- ----------------------------------------------------------------------------

-- Retorna o perfil do usuário logado, somente se a conta estiver ativa.
create or replace function public.usuario_perfil()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select perfil from public.usuarios where id = auth.uid() and ativo = true;
$$;

-- Retorna true se o usuário logado existe e está ativo.
create or replace function public.usuario_ativo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select ativo from public.usuarios where id = auth.uid()), false);
$$;

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY — usuarios
-- ----------------------------------------------------------------------------

alter table public.usuarios enable row level security;

-- Qualquer usuário ativo autenticado pode ler a lista (necessário para exibir
-- nomes de técnicos/suporte em chamados e para popular selects de atribuição).
drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select
  using (public.usuario_ativo());

-- Somente administradores podem criar novos registros de usuário.
drop policy if exists usuarios_insert on public.usuarios;
create policy usuarios_insert on public.usuarios
  for insert
  with check (public.usuario_perfil() = 'admin');

-- Administradores podem atualizar qualquer usuário; o próprio usuário pode
-- atualizar seu registro (nome/telefone) — a troca de perfil/ativo/email por
-- não-admins é bloqueada pelo trigger abaixo.
drop policy if exists usuarios_update on public.usuarios;
create policy usuarios_update on public.usuarios
  for update
  using (public.usuario_perfil() = 'admin' or id = auth.uid())
  with check (public.usuario_perfil() = 'admin' or id = auth.uid());

-- Somente administradores podem excluir um registro de usuário.
drop policy if exists usuarios_delete on public.usuarios;
create policy usuarios_delete on public.usuarios
  for delete
  using (public.usuario_perfil() = 'admin');

-- Bloqueia que um usuário não-admin promova a si mesmo ou reative/desative a
-- própria conta editando o próprio registro.
create or replace function public.usuarios_bloquear_autopromocao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.usuario_perfil() is distinct from 'admin' then
    if new.perfil is distinct from old.perfil
       or new.ativo is distinct from old.ativo
       or new.email is distinct from old.email
    then
      raise exception 'Você não tem permissão para alterar perfil, status ativo ou e-mail.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_usuarios_bloquear_autopromocao on public.usuarios;
create trigger trg_usuarios_bloquear_autopromocao
  before update on public.usuarios
  for each row execute function public.usuarios_bloquear_autopromocao();

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY — chamados
-- ----------------------------------------------------------------------------

alter table public.chamados enable row level security;

-- Admin e suporte veem todos os chamados; técnico só vê os que lhe foram
-- atribuídos.
drop policy if exists chamados_select on public.chamados;
create policy chamados_select on public.chamados
  for select
  using (
    public.usuario_perfil() in ('admin', 'suporte')
    or (public.usuario_perfil() = 'tecnico' and tecnico_id = auth.uid())
  );

-- Somente admin e suporte podem abrir chamados.
drop policy if exists chamados_insert on public.chamados;
create policy chamados_insert on public.chamados
  for insert
  with check (public.usuario_perfil() in ('admin', 'suporte'));

-- Admin/suporte podem atualizar qualquer chamado; técnico só o seu, e apenas
-- os campos de status/observação (reforçado pelo trigger abaixo).
drop policy if exists chamados_update on public.chamados;
create policy chamados_update on public.chamados
  for update
  using (
    public.usuario_perfil() in ('admin', 'suporte')
    or (public.usuario_perfil() = 'tecnico' and tecnico_id = auth.uid())
  )
  with check (
    public.usuario_perfil() in ('admin', 'suporte')
    or (public.usuario_perfil() = 'tecnico' and tecnico_id = auth.uid())
  );

drop policy if exists chamados_delete on public.chamados;
create policy chamados_delete on public.chamados
  for delete
  using (public.usuario_perfil() = 'admin');

-- Impede que um técnico altere dados do chamado além de status/observações.
create or replace function public.chamados_bloquear_edicao_tecnico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.usuario_perfil() = 'tecnico' then
    if new.titulo is distinct from old.titulo
       or new.descricao is distinct from old.descricao
       or new.cliente_nome is distinct from old.cliente_nome
       or new.cliente_contato is distinct from old.cliente_contato
       or new.endereco is distinct from old.endereco
       or new.categoria is distinct from old.categoria
       or new.prioridade is distinct from old.prioridade
       or new.tecnico_id is distinct from old.tecnico_id
       or new.aberto_por is distinct from old.aberto_por
    then
      raise exception 'Técnicos só podem atualizar o status do chamado.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_chamados_bloquear_edicao_tecnico on public.chamados;
create trigger trg_chamados_bloquear_edicao_tecnico
  before update on public.chamados
  for each row execute function public.chamados_bloquear_edicao_tecnico();

-- Mantém atualizado_em sempre em dia a cada UPDATE.
create or replace function public.chamados_set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_chamados_set_atualizado_em on public.chamados;
create trigger trg_chamados_set_atualizado_em
  before update on public.chamados
  for each row execute function public.chamados_set_atualizado_em();

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY — historico_chamados
-- ----------------------------------------------------------------------------

alter table public.historico_chamados enable row level security;

-- Visibilidade do histórico segue a visibilidade do chamado pai.
drop policy if exists historico_select on public.historico_chamados;
create policy historico_select on public.historico_chamados
  for select
  using (
    exists (
      select 1 from public.chamados c
      where c.id = chamado_id
        and (
          public.usuario_perfil() in ('admin', 'suporte')
          or (public.usuario_perfil() = 'tecnico' and c.tecnico_id = auth.uid())
        )
    )
  );

-- Inserções de histórico só acontecem via as funções RPC da seção 6, que já
-- rodam como o próprio usuário (security invoker) e respeitam esta política.
drop policy if exists historico_insert on public.historico_chamados;
create policy historico_insert on public.historico_chamados
  for insert
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.chamados c
      where c.id = chamado_id
        and (
          public.usuario_perfil() in ('admin', 'suporte')
          or (public.usuario_perfil() = 'tecnico' and c.tecnico_id = auth.uid())
        )
    )
  );

-- Histórico é um log de auditoria imutável: sem policies de update/delete
-- (negado por padrão quando RLS está habilitado).

-- ----------------------------------------------------------------------------
-- 6. FUNÇÕES RPC — operações atômicas (chamado + histórico em uma transação)
-- ----------------------------------------------------------------------------

-- Abre um novo chamado e registra o evento de criação (e de atribuição, se um
-- técnico já for informado na abertura).
create or replace function public.criar_chamado(
  p_titulo          text,
  p_descricao       text,
  p_cliente_nome    text,
  p_cliente_contato text,
  p_endereco        text,
  p_categoria       text,
  p_prioridade      text,
  p_tecnico_id      uuid default null
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id bigint;
  v_tecnico_nome text;
begin
  if public.usuario_perfil() not in ('admin', 'suporte') then
    raise exception 'Apenas suporte ou administrador podem abrir chamados.';
  end if;

  insert into public.chamados (
    titulo, descricao, cliente_nome, cliente_contato, endereco,
    categoria, prioridade, tecnico_id, aberto_por
  ) values (
    p_titulo, p_descricao, p_cliente_nome, p_cliente_contato, p_endereco,
    p_categoria, p_prioridade, p_tecnico_id, auth.uid()
  ) returning id into v_id;

  insert into public.historico_chamados (chamado_id, usuario_id, tipo, descricao)
  values (v_id, auth.uid(), 'criacao', 'Chamado aberto.');

  if p_tecnico_id is not null then
    select nome into v_tecnico_nome from public.usuarios where id = p_tecnico_id;
    insert into public.historico_chamados (chamado_id, usuario_id, tipo, descricao)
    values (v_id, auth.uid(), 'atribuicao',
            'Chamado atribuído ao técnico ' || coalesce(v_tecnico_nome, '—') || ' na abertura.');
  end if;

  return v_id;
end;
$$;

grant execute on function public.criar_chamado(text, text, text, text, text, text, text, uuid) to authenticated;

-- Atualiza o status de um chamado e registra o evento no histórico.
create or replace function public.atualizar_status_chamado(
  p_chamado_id  bigint,
  p_novo_status text,
  p_comentario  text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_fechado_em timestamptz;
  v_descricao text;
begin
  if p_novo_status not in ('aberto', 'em_andamento', 'aguardando_peca', 'resolvido', 'fechado') then
    raise exception 'Status inválido: %', p_novo_status;
  end if;

  v_fechado_em := case when p_novo_status = 'fechado' then now() else null end;

  update public.chamados
     set status = p_novo_status,
         fechado_em = v_fechado_em
   where id = p_chamado_id;

  if not found then
    raise exception 'Chamado não encontrado ou sem permissão de acesso.';
  end if;

  v_descricao := 'Status alterado para "' || p_novo_status || '".';
  if p_comentario is not null and length(trim(p_comentario)) > 0 then
    v_descricao := v_descricao || ' Observação: ' || p_comentario;
  end if;

  insert into public.historico_chamados (chamado_id, usuario_id, tipo, descricao)
  values (p_chamado_id, auth.uid(), 'status', v_descricao);
end;
$$;

grant execute on function public.atualizar_status_chamado(bigint, text, text) to authenticated;

-- Adiciona um comentário/observação técnica ao histórico do chamado.
create or replace function public.adicionar_comentario_chamado(
  p_chamado_id bigint,
  p_comentario text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_comentario is null or length(trim(p_comentario)) = 0 then
    raise exception 'Comentário não pode ser vazio.';
  end if;

  if not exists (select 1 from public.chamados where id = p_chamado_id) then
    raise exception 'Chamado não encontrado ou sem permissão de acesso.';
  end if;

  update public.chamados set atualizado_em = now() where id = p_chamado_id;

  insert into public.historico_chamados (chamado_id, usuario_id, tipo, descricao)
  values (p_chamado_id, auth.uid(), 'comentario', p_comentario);
end;
$$;

grant execute on function public.adicionar_comentario_chamado(bigint, text) to authenticated;

-- Atribui (ou reatribui) um técnico a um chamado existente.
create or replace function public.atribuir_tecnico(
  p_chamado_id bigint,
  p_tecnico_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tecnico_nome text;
begin
  if public.usuario_perfil() not in ('admin', 'suporte') then
    raise exception 'Apenas suporte ou administrador podem atribuir técnicos.';
  end if;

  select nome into v_tecnico_nome
    from public.usuarios
   where id = p_tecnico_id and perfil = 'tecnico' and ativo = true;

  if v_tecnico_nome is null then
    raise exception 'Técnico inválido ou inativo.';
  end if;

  update public.chamados set tecnico_id = p_tecnico_id where id = p_chamado_id;

  if not found then
    raise exception 'Chamado não encontrado ou sem permissão de acesso.';
  end if;

  insert into public.historico_chamados (chamado_id, usuario_id, tipo, descricao)
  values (p_chamado_id, auth.uid(), 'atribuicao', 'Chamado atribuído ao técnico ' || v_tecnico_nome || '.');
end;
$$;

grant execute on function public.atribuir_tecnico(bigint, uuid) to authenticated;

-- ============================================================================
-- BOOTSTRAP DO PRIMEIRO ADMIN
-- ============================================================================
-- A política de INSERT em "usuarios" só permite que administradores criem
-- novos usuários — mas o primeiro admin ainda não existe. Para o primeiro
-- acesso:
--
--   1. No painel do Supabase, vá em Authentication > Users > "Add user" e
--      crie o usuário com e-mail e senha do administrador (marque
--      "Auto Confirm User").
--   2. Copie o UID gerado para esse usuário.
--   3. No SQL Editor, rode (substituindo os valores):
--
--        insert into public.usuarios (id, nome, email, perfil, ativo)
--        values ('COLE-O-UID-AQUI', 'Nome do Admin', 'admin@empresa.com', 'admin', true);
--
--   O SQL Editor roda como superusuário do Postgres e ignora RLS, então este
--   passo funciona mesmo sem nenhum admin existente ainda.
--
--   A partir daí, o próprio admin pode cadastrar os usuários de Suporte e
--   Técnico pela tela "Usuários" do sistema.
-- ============================================================================
