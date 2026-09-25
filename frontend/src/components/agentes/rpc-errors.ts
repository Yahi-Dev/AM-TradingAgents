/** Mensajes de las RPC de runs: ver `@/lib/rpc-errors`. */
export { rpcErrorMessage } from "@/lib/rpc-errors";

/**
 * Asigna un error de la RPC `create_trading_run` al campo del formulario al
 * que se refiere (para marcarlo en rojo). Devuelve `null` si es general.
 */
export function fieldForRpcMessage(message: string): "symbol" | "trade_date" | "mode" | "analysts" | null {
  const m = message.toLowerCase();
  if (m.startsWith("símbolo") || m.includes("ticker")) return "symbol";
  if (m.includes("fecha")) return "trade_date";
  if (m.includes("modo") || m.includes("live")) return "mode";
  if (m.includes("analista")) return "analysts";
  return null;
}
