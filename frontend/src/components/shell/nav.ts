/** Navegación principal del área autenticada (rail izquierdo). */
export type NavIcon =
  | "panel"
  | "agentes"
  | "backtesting"
  | "portfolio"
  | "auditoria"
  | "desarrollo"
  | "configuracion";

export type NavItem = {
  href: string;
  /** Nombre completo (tooltip, breadcrumb). */
  label: string;
  /** Nombre corto bajo el icono del rail. */
  short: string;
  icon: NavIcon;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/panel", label: "Panel de control", short: "Panel", icon: "panel" },
  { href: "/agentes", label: "Centro Agéntico", short: "Agentes", icon: "agentes" },
  { href: "/backtesting", label: "Laboratorio de backtesting", short: "Backtest", icon: "backtesting" },
  { href: "/portfolio", label: "Portfolio y riesgo", short: "Riesgo", icon: "portfolio" },
  { href: "/auditoria", label: "Bitácora y auditoría", short: "Bitácora", icon: "auditoria" },
  { href: "/desarrollo", label: "Desarrollo", short: "Desarrollo", icon: "desarrollo" },
  { href: "/configuracion", label: "Configuración", short: "Config", icon: "configuracion" },
];

/** Elemento de navegación activo para una ruta (coincidencia por prefijo). */
export function activeNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
