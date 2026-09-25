#!/usr/bin/env python3
"""Genera la semilla SQL de ``public.dev_stories`` y el script ``supabase/setup.sql``.

Fuente de verdad: ``docs/control-plane/stories.yaml``.

Salidas (ambas se versionan en git; no se editan a mano):

* ``supabase/migrations/0002_seed_dev_stories.sql``: upsert idempotente
  (``insert ... on conflict (id) do update``) de todas las stories, con
  ``seq`` = orden de aparición en el YAML. Elimina filas cuyo id ya no existe
  en el YAML, para que el panel "Desarrollo" refleje el fichero.
* ``supabase/setup.sql``: concatenación de ``supabase/migrations/*.sql`` en
  orden léxico, para pegar a mano en el SQL editor de Supabase.

El YAML contiene texto UTF-8 doblemente codificado (mojibake cp1252, p. ej.
``AgÃ©ntico``); cada cadena se repara con ``s.encode('cp1252').decode('utf-8')``
cuando el viaje de ida y vuelta es válido, y se deja intacta en caso contrario.

Uso::

    python scripts/generate_supabase_seed.py           # escribe los ficheros
    python scripts/generate_supabase_seed.py --check   # falla si están desactualizados

Dependencias: biblioteca estándar + PyYAML.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
STORIES_YAML = REPO_ROOT / "docs" / "control-plane" / "stories.yaml"
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"
SEED_FILE = MIGRATIONS_DIR / "0002_seed_dev_stories.sql"
SETUP_FILE = REPO_ROOT / "supabase" / "setup.sql"

ADVISORY_LOCK_KEY = 7240011001  # mismo que 0001_init.sql


# ---------------------------------------------------------------------------
# Reparación de mojibake
# ---------------------------------------------------------------------------


def _to_cp1252_bytes(text: str) -> bytes | None:
    """Codifica como cp1252; los 5 bytes que cp1252 no define (0x81, 0x8D,
    0x8F, 0x90, 0x9D) suelen sobrevivir como U+0081..U+009D (latin-1)."""
    out = bytearray()
    for ch in text:
        try:
            out += ch.encode("cp1252")
        except UnicodeEncodeError:
            if ord(ch) < 256:
                out.append(ord(ch))
            else:
                return None
    return bytes(out)


def fix_mojibake(text: str) -> str:
    """Devuelve ``text`` reparado si era UTF-8 leído como cp1252; si no, intacto."""
    if text.isascii():
        return text
    raw = _to_cp1252_bytes(text)
    if raw is None:
        return text
    try:
        fixed = raw.decode("utf-8")
    except UnicodeDecodeError:
        return text
    return fixed


def fix_tree(value: Any) -> Any:
    if isinstance(value, str):
        return fix_mojibake(value)
    if isinstance(value, list):
        return [fix_tree(v) for v in value]
    if isinstance(value, dict):
        return {fix_tree(k): fix_tree(v) for k, v in value.items()}
    return value


# ---------------------------------------------------------------------------
# SQL helpers
# ---------------------------------------------------------------------------


def sql_literal(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    text = str(value)
    if "\x00" in text:
        raise ValueError("NUL byte en un valor de texto")
    return "'" + text.replace("'", "''") + "'"


def sql_text_array(values: list[Any]) -> str:
    if not values:
        return "'{}'::text[]"
    return "array[" + ", ".join(sql_literal(str(v)) for v in values) + "]::text[]"


# ---------------------------------------------------------------------------
# Carga de stories
# ---------------------------------------------------------------------------


def load_stories(path: Path = STORIES_YAML) -> list[dict[str, Any]]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("stories"), dict):
        raise ValueError(f"{path}: se esperaba un mapeo 'stories' en la raíz")
    data = fix_tree(data)

    rows: list[dict[str, Any]] = []
    for seq, (story_id, story) in enumerate(data["stories"].items(), start=1):
        if not isinstance(story, dict):
            raise ValueError(f"{story_id}: se esperaba un mapeo")
        title = story.get("title")
        status = story.get("status")
        if not title or not status:
            raise ValueError(f"{story_id}: 'title' y 'status' son obligatorios")
        depends_on = story.get("depends_on") or []
        if not isinstance(depends_on, list):
            raise ValueError(f"{story_id}: 'depends_on' debe ser una lista")
        rows.append(
            {
                "id": str(story_id),
                "seq": seq,
                "title": str(title),
                "epic": story.get("epic"),
                "risk_level": story.get("autonomy_risk"),
                "status": str(status),
                "depends_on": [str(d) for d in depends_on],
            }
        )
    return rows


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------


def render_seed(rows: list[dict[str, Any]]) -> str:
    values = ",\n".join(
        "  ("
        + ", ".join(
            [
                sql_literal(r["id"]),
                sql_literal(r["seq"]),
                sql_literal(r["title"]),
                sql_literal(r["epic"]),
                sql_literal(r["risk_level"]),
                sql_literal(r["status"]),
                sql_text_array(r["depends_on"]),
            ]
        )
        + ")"
        for r in rows
    )
    ids = ", ".join(sql_literal(r["id"]) for r in rows)
    return f"""-- =============================================================================
-- AM-TradingAgents — semilla de public.dev_stories
-- Migration : 0002_seed_dev_stories.sql
-- GENERADO por scripts/generate_supabase_seed.py a partir de
-- docs/control-plane/stories.yaml. NO editar a mano: regenerar con
--   python scripts/generate_supabase_seed.py
-- Idempotente: upsert por id (solo actualiza filas que cambian) y elimina las
-- stories que ya no están en el YAML. {len(rows)} stories.
-- =============================================================================

begin;

set local statement_timeout = '60s';
set local lock_timeout = '15s';

select pg_advisory_xact_lock({ADVISORY_LOCK_KEY});

insert into public.dev_stories as d (id, seq, title, epic, risk_level, status, depends_on)
values
{values}
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
 where d.id not in ({ids});

commit;
"""


def render_setup(migration_files: list[Path], seed_override: str | None = None) -> str:
    header = """-- =============================================================================
-- AM-TradingAgents — setup.sql (instalación MANUAL en Supabase)
--
-- GENERADO por scripts/generate_supabase_seed.py: concatenación, en orden, de
-- supabase/migrations/*.sql. NO editar a mano.
--
-- Uso: Supabase Dashboard -> SQL Editor -> New query -> pegar TODO este fichero
-- -> Run. Es idempotente: puede ejecutarse varias veces sin romper nada.
--
-- Normalmente no hace falta: frontend/scripts/migrate.mjs aplica estas mismas
-- migraciones en cada build de Vercel si existe POSTGRES_URL_NON_POOLING,
-- POSTGRES_URL o SUPABASE_DB_URL.
-- =============================================================================
"""
    parts = [header]
    for f in migration_files:
        body = (
            seed_override
            if (seed_override is not None and f.name == SEED_FILE.name)
            else f.read_text(encoding="utf-8")
        )
        parts.append(f"\n-- >>>>>>>>>>>>>>>>>>>> {f.name} >>>>>>>>>>>>>>>>>>>>\n\n")
        parts.append(body.rstrip("\n") + "\n")
        parts.append(f"\n-- <<<<<<<<<<<<<<<<<<<< fin de {f.name} <<<<<<<<<<<<<<<<<<<<\n")
    return "".join(parts)


def _migration_files() -> list[Path]:
    files = sorted(p for p in MIGRATIONS_DIR.glob("*.sql") if p.is_file())
    if SEED_FILE not in files:
        files = sorted([*files, SEED_FILE])
    return files


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument(
        "--check",
        action="store_true",
        help="no escribe; sale con 1 si los ficheros están desactualizados",
    )
    args = parser.parse_args(argv)

    rows = load_stories()
    seed_sql = render_seed(rows)
    setup_sql = render_setup(_migration_files(), seed_override=seed_sql)

    outputs = {SEED_FILE: seed_sql, SETUP_FILE: setup_sql}
    if args.check:
        stale = [
            p
            for p, content in outputs.items()
            if not p.exists() or p.read_text(encoding="utf-8") != content
        ]
        for p in stale:
            print(f"desactualizado: {p.relative_to(REPO_ROOT)}", file=sys.stderr)
        return 1 if stale else 0

    MIGRATIONS_DIR.mkdir(parents=True, exist_ok=True)
    for path, content in outputs.items():
        path.write_text(content, encoding="utf-8", newline="\n")
        print(f"escrito: {path.relative_to(REPO_ROOT)}")
    print(f"{len(rows)} stories")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
