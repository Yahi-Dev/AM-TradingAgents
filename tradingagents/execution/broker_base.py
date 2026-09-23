"""Interfaz de broker neutral y tipos de orden.

Contrato que todo broker concreto implementa. El grafo de agentes y el
traductor de órdenes hablan SOLO con estos tipos, nunca con el SDK de un
broker específico. Añadir un broker nuevo = una subclase de ``Broker``; no se
toca el grafo.

Seguridad por defecto: ``TradingMode.PAPER``. El modo ``LIVE`` debe activarse
de forma explícita Y confirmarse por orden (``place_order(..., confirm=True)``);
en cualquier otro caso la implementación hace *dry-run* (registra, no envía).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from enum import Enum

from pydantic import BaseModel, Field

from tradingagents.portfolio import PortfolioContext


class TradingMode(str, Enum):
    """Entorno de ejecución. PAPER es el valor por defecto en todo el sistema."""

    PAPER = "paper"
    LIVE = "live"


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"
    SELL_SHORT = "sell_short"
    BUY_TO_COVER = "buy_to_cover"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


class OrderRequest(BaseModel):
    """Orden neutral, independiente del broker.

    Producida por el `OrderTranslator` a partir de `PortfolioDecision` /
    `TraderProposal`, consumida por cualquier `Broker`.
    """

    ticker: str = Field(description="Símbolo del instrumento, p.ej. AAPL")
    side: OrderSide
    quantity: float = Field(gt=0, description="Unidades (positivo; el lado lo da `side`)")
    order_type: OrderType = OrderType.MARKET
    limit_price: float | None = Field(default=None, description="Requerido para LIMIT/STOP_LIMIT")
    stop_price: float | None = Field(default=None, description="Requerido para STOP/STOP_LIMIT")
    # Niveles de gestión que vienen de la propuesta del trader (Macroproceso 4).
    take_profit: float | None = None
    stop_loss: float | None = None
    time_in_force: str = "day"
    client_order_id: str | None = Field(default=None, description="Idempotencia por tenant")


class OrderResult(BaseModel):
    """Resultado de enviar una orden."""

    accepted: bool
    broker_order_id: str | None = None
    status: str = ""
    filled_quantity: float = 0.0
    avg_fill_price: float | None = None
    commission: float | None = None
    dry_run: bool = False
    raw: dict | None = Field(default=None, description="Respuesta cruda del broker para auditoría")
    message: str = ""


class BrokerAccount(BaseModel):
    """Instantánea de cuenta para el gate de riesgo (Macroproceso 4)."""

    account_id: str
    cash: float | None = None
    buying_power: float | None = None
    equity: float | None = None
    currency: str = "USD"


class Broker(ABC):
    """Interfaz que implementa cada broker concreto."""

    def __init__(self, mode: TradingMode = TradingMode.PAPER):
        self.mode = mode

    # --- Lectura (alimenta contexto y gate de riesgo) ---
    @abstractmethod
    def get_account(self) -> BrokerAccount:
        """Balances y buying power actuales."""

    @abstractmethod
    def get_portfolio_context(self) -> PortfolioContext:
        """Posiciones + cash como el grafo los espera (entrada al Macroproceso 3)."""

    # --- Escritura (ejecución) ---
    @abstractmethod
    def place_order(self, order: OrderRequest, *, confirm: bool = False) -> OrderResult:
        """Envía una orden.

        Debe hacer *dry-run* (no enviar) salvo que ``mode == LIVE`` y
        ``confirm is True``. La subclase es responsable de honrar esta guarda.
        """

    @abstractmethod
    def cancel_order(self, broker_order_id: str) -> OrderResult:
        """Cancela una orden abierta."""

    @abstractmethod
    def get_transactions(self, *, days: int = 7) -> list[dict]:
        """Historial post-trade (fills, comisiones) para el Macroproceso 6."""

    # --- Guarda compartida ---
    def _is_live_send(self, confirm: bool) -> bool:
        """True solo si de verdad hay que enviar a mercado real."""
        return self.mode == TradingMode.LIVE and confirm
