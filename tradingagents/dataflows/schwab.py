"""Vendor de datos Schwab para el router de `interface.py`.

Respeta el contrato de los vendors existentes: funciones que reciben
``(symbol, start_date, end_date)`` (u opciones análogas) y devuelven un ``str``
formateado listo para el prompt del agente. ``schwab-py`` (MIT) se importa de
forma PEREZOSA, de modo que importar este módulo no falla si la dependencia no
está instalada — igual que el resto de vendors opcionales.

Registro en el router (una vez implementado), en ``dataflows/interface.py``:

    from .schwab import get_stock as get_schwab_stock
    VENDOR_LIST.append("schwab")
    VENDOR_METHODS["get_stock_data"]["schwab"] = get_schwab_stock
    # ...y análogamente para quotes / opciones / L2.

Y en config ``data_vendors``: ``"core_stock_apis": "schwab,yfinance"`` (Schwab
primero, yfinance como fallback).
"""

from __future__ import annotations

from typing import Any

from .errors import VendorNotConfiguredError


def _get_client() -> Any:
    """Cliente schwab-py autenticado (import perezoso).

    En un despliegue multi-tenant, el token del cliente correspondiente se
    resuelve aquí (desde Postgres, descifrado). De momento se lee de entorno.
    """
    import os

    try:
        from schwab.auth import client_from_token_file  # type: ignore
    except ImportError as exc:  # pragma: no cover - dependencia opcional
        raise VendorNotConfiguredError(
            "El vendor 'schwab' requiere 'schwab-py'. Instálalo con "
            "`pip install schwab-py`."
        ) from exc

    token_path = os.getenv("SCHWAB_TOKEN_PATH")
    api_key = os.getenv("SCHWAB_API_KEY")
    app_secret = os.getenv("SCHWAB_APP_SECRET")
    if not (token_path and api_key and app_secret):
        raise VendorNotConfiguredError(
            "Faltan SCHWAB_TOKEN_PATH / SCHWAB_API_KEY / SCHWAB_APP_SECRET."
        )
    return client_from_token_file(token_path, api_key, app_secret)


def get_stock(symbol: str, start_date: str, end_date: str) -> str:
    """OHLCV histórico vía Schwab Price History. Devuelve CSV/markdown para el prompt.

    TODO: client.get_price_history_every_day(symbol, start_datetime=..., end_datetime=...)
          -> parsear candles -> mismo formato CSV que los otros vendors.
    """
    _client = _get_client()
    raise NotImplementedError("Schwab get_price_history -> CSV (formato de core_stock_apis)")


def get_quote(symbol: str) -> str:
    """Quote en tiempo real (dato que thinkorswim muestra en pantalla).

    TODO: client.get_quote(symbol) -> resumen (last, bid, ask, volumen).
    """
    _client = _get_client()
    raise NotImplementedError("Schwab get_quote -> str")


def get_option_chain(symbol: str) -> str:
    """Cadena de opciones (fortaleza de thinkorswim).

    TODO: client.get_option_chain(symbol, ...) -> resumen de strikes/greeks.
    """
    _client = _get_client()
    raise NotImplementedError("Schwab get_option_chain -> str")
