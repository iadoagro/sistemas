# PROJECT_STYLE.md
# Design system deste projeto. Edite à vontade.
# Gerado em: 2026-09-16

## Projeto
name: Sistema
description: Sistema web para abertura e gerenciamento de chamados de suporte técnico de uma provedora de internet via fibra óptica.
tone: Profissional e confiável

## Stack
framework: HTML puro (vanilla JS, sem framework)
typescript: não
component_library: nenhuma
icons: SVG inline (sem biblioteca externa, evita dependência de CDN de ícones)
animations: CSS puro (transições simples)

## Cores
primary: "#2563EB"
primary_hover: "#1D4ED8"
background: "#F5F7FA"
surface: "#FFFFFF"
border: "#E2E8F0"
text_primary: "#0F172A"
text_secondary: "#64748B"
accent: "#2563EB"
success: "#16A34A"
error: "#DC2626"
warning: "#D97706"

## Dark Mode
dark_mode: light_only

## Tipografia
font_heading: "Inter — Google Fonts (fallback: system-ui, sans-serif)"
font_body: "Inter — Google Fonts (fallback: system-ui, sans-serif)"
font_mono: "ui-monospace — sistema (sem dependência externa)"

## Layout & Tokens
# Arredondamento: none | subtle (4-6px) | modern (8-12px) | rounded (16px+)
border_radius: modern

# Densidade: compact | balanced | spacious
density: balanced

## Componentes Específicos do Domínio
- StatusBadge: pílula colorida por status do chamado (aberto=azul, em_andamento=âmbar, aguardando_peca=roxo, resolvido=verde, fechado=cinza)
- PrioridadeBadge: pílula por prioridade (baixa=cinza, media=azul, alta=âmbar, urgente=vermelho)
- KpiCard: card com número grande + label + ícone, usado no dashboard admin
- ChamadoCard/Row: linha de tabela/lista com título, cliente, técnico, prioridade, status, data
- TimelineItem: item de histórico do chamado (autor, data/hora, tipo de evento, descrição) em linha do tempo vertical
- Toast: notificação de sucesso/erro no canto da tela, auto-dismiss
- EmptyState: ícone + mensagem quando lista está vazia
