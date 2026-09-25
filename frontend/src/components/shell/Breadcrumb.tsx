"use client";

import { usePathname } from "next/navigation";

import { activeNavItem } from "./nav";
import styles from "./shell.module.css";

/** Migas de pan: "<workspace> › <pantalla actual>". */
export function Breadcrumb({ workspace }: { workspace: string }) {
  const pathname = usePathname();
  const item = activeNavItem(pathname);
  const isDetail = item ? pathname !== item.href : false;
  return (
    <nav className={styles.crumbs} aria-label="Ubicación">
      <span className={styles.crumbWorkspace}>{workspace}</span>
      <span className={styles.crumbSep} aria-hidden="true">
        ›
      </span>
      <span className={styles.crumbCurrent} aria-current="page">
        {item ? item.label : "Command Center"}
        {isDetail ? " · Detalle" : ""}
      </span>
    </nav>
  );
}
