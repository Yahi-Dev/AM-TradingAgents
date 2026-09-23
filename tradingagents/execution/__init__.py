"""Capa de ejecución (Macroproceso 5) — inexistente en el repo original.

El grafo de agentes produce una `PortfolioDecision`; esta capa la traduce a
órdenes y las envía a un broker real. Todo broker concreto (Schwab, Alpaca,
IBKR...) implementa la interfaz `Broker` de ``broker_base``, de modo que el
grafo permanece broker-neutral (igual que ``tradingagents/portfolio.py``).
"""

from .broker_base import (
    Broker,
    BrokerAccount,
    OrderRequest,
    OrderResult,
    OrderSide,
    OrderType,
    TradingMode,
)

__all__ = [
    "Broker",
    "BrokerAccount",
    "OrderRequest",
    "OrderResult",
    "OrderSide",
    "OrderType",
    "TradingMode",
]
