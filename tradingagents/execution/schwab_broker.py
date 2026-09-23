"""Implementación del `Broker` sobre la Schwab Trader API.

Usa ``schwab-py`` (MIT), importado de forma PEREZOSA: el módulo se puede
importar sin tener la dependencia instalada; solo falla al instanciar el broker
sin ella. Así el resto del sistema arranca aunque Schwab no esté configurado.

    pip install "tradingagents[schwab]"     # ver setup / pyproject extras

Autenticación: OAuth 2.0. El refresh token de Schwab caduca a los 7 días; en un
SaaS multi-tenant, cada cliente tiene su propio token cifrado en Postgres y una
tarea programada que lo renueva. Aquí se recibe ya un cliente autenticado.

TODO: los cuerpos marcados con `raise NotImplementedError` son los puntos donde
va la llamada real a la API (referencia: schwab-py.readthedocs.io).
"""

from __future__ import annotations

from typing import Any

from tradingagents.portfolio import PortfolioContext, Position

from .broker_base import (
    Broker,
    BrokerAccount,
    OrderRequest,
    OrderResult,
    OrderSide,
    OrderType,
    TradingMode,
)


def _load_schwab_client(token_path: str, api_key: str, app_secret: str, callback_url: str) -> Any:
    """Importa schwab-py de forma perezosa y devuelve un cliente autenticado."""
    try:
        from schwab.auth import easy_client  # type: ignore
    except ImportError as exc:  # pragma: no cover - depende de instalación opcional
        raise ImportError(
            "La integración con Schwab requiere 'schwab-py'. Instálalo con "
            "`pip install schwab-py` o `pip install \"tradingagents[schwab]\"`."
        ) from exc
    return easy_client(api_key=api_key, app_secret=app_secret,
                       callback_url=callback_url, token_path=token_path)


class SchwabBroker(Broker):
    """Broker Schwab. PAPER por defecto; LIVE exige modo + confirm explícitos."""

    def __init__(self, client: Any, account_hash: str, mode: TradingMode = TradingMode.PAPER):
        super().__init__(mode=mode)
        self._client = client          # cliente schwab-py ya autenticado
        self._account_hash = account_hash

    # ------------------------------------------------------------------ lectura
    def get_account(self) -> BrokerAccount:
        # TODO: resp = self._client.get_account(self._account_hash, fields=[...])
        #       mapear balances (cashBalance, buyingPower, liquidationValue).
        raise NotImplementedError("Mapear Schwab GET /accounts/{hash} -> BrokerAccount")

    def get_portfolio_context(self) -> PortfolioContext:
        # TODO: resp = self._client.get_account(self._account_hash, fields=["positions"])
        #       construir Position(ticker, quantity con signo, average_price).
        positions: list[Position] = []
        raise NotImplementedError(
            "Mapear posiciones Schwab -> PortfolioContext(positions=..., cash=...)"
        )
        return PortfolioContext(positions=positions)  # noqa: unreachable (plantilla)

    def get_transactions(self, *, days: int = 7) -> list[dict]:
        # TODO: self._client.get_transactions(self._account_hash, start_date=..., end_date=...)
        raise NotImplementedError("Mapear Schwab GET /transactions -> list[dict]")

    # --------------------------------------------------------------- ejecución
    def place_order(self, order: OrderRequest, *, confirm: bool = False) -> OrderResult:
        spec = self._to_schwab_order(order)  # traducción a OrderBuilder de schwab-py

        # Guarda de seguridad: sin LIVE + confirm explícitos, NO se envía.
        if not self._is_live_send(confirm):
            return OrderResult(
                accepted=True,
                dry_run=True,
                status="dry_run",
                message=(
                    f"DRY-RUN ({self.mode.value}): {order.side.value} {order.quantity} "
                    f"{order.ticker} @ {order.order_type.value}. "
                    "No se envió a mercado (modo LIVE + confirm=True requeridos)."
                ),
                raw={"schwab_order_spec": spec},
            )

        # TODO (solo LIVE + confirm): envío real
        #   resp = self._client.place_order(self._account_hash, spec)
        #   order_id = schwab.utils.Utils(self._client, self._account_hash)\
        #                    .extract_order_id(resp)
        raise NotImplementedError("Enviar Schwab POST /accounts/{hash}/orders")

    def cancel_order(self, broker_order_id: str) -> OrderResult:
        # TODO: self._client.cancel_order(broker_order_id, self._account_hash)
        raise NotImplementedError("Schwab DELETE /accounts/{hash}/orders/{id}")

    # ----------------------------------------------------------------- helpers
    def _to_schwab_order(self, order: OrderRequest) -> dict:
        """Traduce `OrderRequest` neutral -> spec de orden Schwab (OrderBuilder).

        schwab-py ofrece plantillas: equity_buy_market, equity_buy_limit, etc.
        Aquí se devolvería el objeto OrderBuilder construido; de momento un dict
        descriptivo para el dry-run.
        """
        return {
            "symbol": order.ticker,
            "instruction": order.side.value,
            "quantity": order.quantity,
            "orderType": order.order_type.value,
            "limitPrice": order.limit_price,
            "stopPrice": order.stop_price,
            "timeInForce": order.time_in_force,
        }
