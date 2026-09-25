"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIconSvg } from "./icons";
import { NAV_ITEMS, activeNavItem } from "./nav";
import styles from "./shell.module.css";

export type RailProps = {
  /** Inicial(es) para el avatar (email o nombre del usuario). */
  userInitials: string;
  /** Texto del tooltip del avatar. */
  userLabel: string;
};

/** Rail de navegación (72px). Por debajo de 900px se convierte en barra horizontal. */
export function Rail({ userInitials, userLabel }: RailProps) {
  const pathname = usePathname();
  const active = activeNavItem(pathname);

  return (
    <nav className={styles.rail} aria-label="Navegación principal">
      <Link href="/panel" className={styles.logo} aria-label="AM Command Center: Panel de control">
        AM
      </Link>
      <ul className={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const isActive = active?.href === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
              >
                <NavIconSvg icon={item.icon} size={20} />
                <span className={styles.navShort}>{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className={styles.railFooter}>
        <span className={styles.avatar} title={userLabel} aria-label={`Usuario: ${userLabel}`}>
          {userInitials}
        </span>
      </div>
    </nav>
  );
}
