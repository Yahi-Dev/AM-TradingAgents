"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";

import styles from "./configuracion.module.css";

type CopyStatus = "idle" | "copied" | "error";

/** Copia `text` al portapapeles y muestra "Copiado" durante 2 s. */
export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    setStatus(ok ? "copied" : "error");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <Button size="sm" variant="ghost" className={styles.copy} onClick={copy} aria-live="polite">
      {status === "copied" ? "Copiado ✓" : status === "error" ? "Selecciona y copia" : label}
    </Button>
  );
}
