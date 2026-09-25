-- =============================================================================
-- AM-TradingAgents — semilla de public.dev_stories
-- Migration : 0002_seed_dev_stories.sql
-- GENERADO por scripts/generate_supabase_seed.py a partir de
-- docs/control-plane/stories.yaml. NO editar a mano: regenerar con
--   python scripts/generate_supabase_seed.py
-- Idempotente: upsert por id (solo actualiza filas que cambian) y elimina las
-- stories que ya no están en el YAML. 20 stories.
-- =============================================================================

begin;

set local statement_timeout = '60s';
set local lock_timeout = '15s';

select pg_advisory_xact_lock(7240011001);

insert into public.dev_stories as d (id, seq, title, epic, risk_level, status, depends_on)
values
  ('US-INFRA-0001', 1, 'Repository structure & CI skeleton', 'EPIC-INFRA-001', 'GREEN', 'DONE', '{}'::text[]),
  ('US-INFRA-0002', 2, 'PostgreSQL + Alembic migrations', 'EPIC-INFRA-001', 'YELLOW', 'READY', array['US-INFRA-0001']::text[]),
  ('US-INFRA-0003', 3, 'FastAPI skeleton + health endpoint', 'EPIC-INFRA-001', 'BLUE', 'DONE', array['US-INFRA-0001']::text[]),
  ('US-SEC-0001', 4, 'JWT auth + tenant model', 'EPIC-INFRA-001', 'YELLOW', 'READY', array['US-INFRA-0002', 'US-INFRA-0003']::text[]),
  ('US-DATA-0001', 5, 'OHLCV ingestion (yfinance)', 'EPIC-DATA-001', 'BLUE', 'DONE', array['US-INFRA-0002']::text[]),
  ('US-AGENT-0001', 6, 'TradingRun lifecycle + TradeIntent schema', 'EPIC-AGENT-001', 'BLUE', 'DONE', array['US-INFRA-0002', 'US-INFRA-0003']::text[]),
  ('US-AGENT-0002', 7, 'Technical Analyst integration', 'EPIC-AGENT-001', 'BLUE', 'BLOCKED_AUTOMATION', array['US-AGENT-0001', 'US-DATA-0001']::text[]),
  ('US-AGENT-0003', 8, 'Bull/Bear debate + Research Manager', 'EPIC-AGENT-001', 'BLUE', 'DRAFT', array['US-AGENT-0002']::text[]),
  ('US-AGENT-0004', 9, 'Trader + Portfolio Manager → TradeIntent', 'EPIC-AGENT-001', 'BLUE', 'DRAFT', array['US-AGENT-0003']::text[]),
  ('US-RISK-0001', 10, 'Risk Engine — pre-trade evaluation', 'EPIC-RISK-001', 'ORANGE', 'DRAFT', array['US-AGENT-0004']::text[]),
  ('US-RISK-0002', 11, 'Kill Switch', 'EPIC-RISK-001', 'ORANGE', 'DRAFT', array['US-RISK-0001']::text[]),
  ('US-OMS-0001', 12, 'OMS — order lifecycle (PaperBroker)', 'EPIC-OMS-001', 'ORANGE', 'DRAFT', array['US-RISK-0001']::text[]),
  ('US-PORT-0001', 13, 'Portfolio positions + P&L', 'EPIC-PORT-001', 'YELLOW', 'DRAFT', array['US-OMS-0001']::text[]),
  ('US-AUDIT-0001', 14, 'DecisionTrace creation', 'EPIC-AUDIT-001', 'YELLOW', 'DRAFT', array['US-AGENT-0004', 'US-RISK-0001', 'US-OMS-0001']::text[]),
  ('US-API-0001', 15, 'POST /runs + GET /runs/{id}', 'EPIC-API-001', 'BLUE', 'DRAFT', array['US-AGENT-0004', 'US-RISK-0001']::text[]),
  ('US-API-0002', 16, 'SSE event stream /runs/{id}/events', 'EPIC-API-001', 'BLUE', 'DRAFT', array['US-API-0001']::text[]),
  ('US-UI-0001', 17, 'Design system + layout shell', 'EPIC-UI-001', 'GREEN', 'BLOCKED_AUTOMATION', array['US-INFRA-0003']::text[]),
  ('US-UI-0002', 18, 'Panel 01 — Dashboard principal', 'EPIC-UI-001', 'GREEN', 'DRAFT', array['US-UI-0001', 'US-PORT-0001']::text[]),
  ('US-UI-0003', 19, 'Panel 02 — Centro Agéntico + Live Graph', 'EPIC-UI-001', 'GREEN', 'DRAFT', array['US-UI-0001', 'US-API-0002']::text[]),
  ('US-UI-0004', 20, 'Onboarding 5 pasos', 'EPIC-UI-001', 'GREEN', 'DRAFT', array['US-UI-0001', 'US-SEC-0001']::text[])
on conflict (id) do update
   set seq        = excluded.seq,
       title      = excluded.title,
       epic       = excluded.epic,
       risk_level = excluded.risk_level,
       status     = excluded.status,
       depends_on = excluded.depends_on
 where (d.seq, d.title, d.epic, d.risk_level, d.status, d.depends_on)
       is distinct from
       (excluded.seq, excluded.title, excluded.epic, excluded.risk_level, excluded.status, excluded.depends_on);

delete from public.dev_stories d
 where d.id not in ('US-INFRA-0001', 'US-INFRA-0002', 'US-INFRA-0003', 'US-SEC-0001', 'US-DATA-0001', 'US-AGENT-0001', 'US-AGENT-0002', 'US-AGENT-0003', 'US-AGENT-0004', 'US-RISK-0001', 'US-RISK-0002', 'US-OMS-0001', 'US-PORT-0001', 'US-AUDIT-0001', 'US-API-0001', 'US-API-0002', 'US-UI-0001', 'US-UI-0002', 'US-UI-0003', 'US-UI-0004');

commit;
