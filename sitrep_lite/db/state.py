from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from .. import paths

MIGRATIONS_DIR = Path(__file__).parent / "migrations" / "state"


def _connect(path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(path or str(paths.STATE_DB), isolation_level=None, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.row_factory = sqlite3.Row
    return conn


def migrate(path: str | None = None) -> int:
    target = path or str(paths.STATE_DB)
    Path(target).parent.mkdir(parents=True, exist_ok=True)
    autocommit = _connect(target)
    try:
        autocommit.execute(
            "CREATE TABLE IF NOT EXISTS state_schema_version "
            "(version INTEGER PRIMARY KEY)"
        )
        row = autocommit.execute(
            "SELECT MAX(version) AS v FROM state_schema_version"
        ).fetchone()
        current = row["v"] or 0
    finally:
        autocommit.close()
    applied = 0
    for sql_file in sorted(MIGRATIONS_DIR.glob("[0-9]*.sql")):
        num = int(sql_file.name.split("_")[0])
        if num <= current:
            continue
        tx = sqlite3.connect(target)
        tx.execute("PRAGMA foreign_keys=ON")
        try:
            with tx:
                tx.executescript(sql_file.read_text())
                tx.execute(
                    "INSERT INTO state_schema_version (version) VALUES (?)", (num,),
                )
        finally:
            tx.close()
        applied += 1
    return applied


@contextmanager
def get_conn(path: str | None = None) -> Iterator[sqlite3.Connection]:
    conn = _connect(path or str(paths.STATE_DB))
    try:
        yield conn
    finally:
        conn.close()
