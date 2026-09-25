import { CodeBlock } from "./CodeBlock";
import styles from "./configuracion.module.css";
import { WORKER_BRANCH, WORKER_DEFAULTS } from "./settings-form";

export type WorkerSetupStepsProps = {
  /** URL pública del proyecto Supabase (NEXT_PUBLIC_SUPABASE_URL) o null. */
  supabaseUrl: string | null;
  /** Valores sugeridos para el .env (por defecto, los del worker). */
  backendUrl?: string | null;
  deepModel?: string | null;
  quickModel?: string | null;
  /** ID del workspace (tenant) del usuario: el worker solo procesará sus runs. */
  tenantId?: string | null;
  /** Versión corta (onboarding): omite la instalación de dependencias. */
  compact?: boolean;
};

/** Aviso de que la service role key es secreta. */
export function ServiceKeyWarning() {
  return (
    <div className={styles.secretWarning} role="note">
      <span className={styles.warnIcon} aria-hidden="true">
        !
      </span>
      <p className="small">
        <strong>La service_role key es SECRETA:</strong> salta todas las políticas de seguridad (RLS) de la base de
        datos. Guárdala solo en el <code>.env</code> de tu PC (está en <code>.gitignore</code>). Nunca la pongas en
        Vercel, ni en una variable <code>NEXT_PUBLIC_*</code>, ni en git, ni la compartas en chats o capturas. La web
        solo usa la clave pública y tu sesión.
      </p>
    </div>
  );
}

/**
 * Instrucciones de copiar y pegar (Windows PowerShell) para arrancar el worker
 * local, que reclama los análisis en cola y los ejecuta con el modelo local.
 */
export function WorkerSetupSteps({
  supabaseUrl,
  backendUrl,
  deepModel,
  quickModel,
  tenantId,
  compact,
}: WorkerSetupStepsProps) {
  const url = supabaseUrl?.replace(/\/+$/, "") || "https://TU-PROYECTO.supabase.co";
  const backend = backendUrl?.trim() || WORKER_DEFAULTS.backendUrl;
  const deep = deepModel?.trim() || WORKER_DEFAULTS.model;
  const quick = quickModel?.trim() || WORKER_DEFAULTS.model;

  const envFile = [
    `SUPABASE_URL=${url}`,
    "SUPABASE_SERVICE_ROLE_KEY=PEGA_AQUI_TU_SERVICE_ROLE_KEY",
    `AM_LLM_PROVIDER=${WORKER_DEFAULTS.provider}`,
    `AM_BACKEND_URL=${backend}`,
    `AM_DEEP_MODEL=${deep}`,
    `AM_QUICK_MODEL=${quick}`,
    `AM_WORKER_POLL_SECONDS=${WORKER_DEFAULTS.pollSeconds}`,
    "# Solo procesa los análisis de tu workspace (recomendado)",
    `AM_WORKER_TENANT_IDS=${tenantId?.trim() || "ID_DE_TU_WORKSPACE"}`,
    "# Opcional: informes en español (si el rating sale REVIEW, quita esta línea)",
    "# TRADINGAGENTS_OUTPUT_LANGUAGE=Spanish",
  ].join("\n");

  const modelsUrl = `${backend.replace(/\/+$/, "")}/models`;

  return (
    <ol className={styles.steps}>
      <li className={styles.step}>
        <div className={styles.stepBody}>
          <span className={styles.stepTitle}>Consigue la service_role key</span>
          <span className={styles.stepText}>
            En Supabase: <strong>Project Settings → API</strong> (API Keys). Copia la clave <code>service_role</code>{" "}
            (en «Legacy API keys») o crea una <em>Secret key</em> (<code>sb_secret_…</code>). La URL del proyecto ya
            está rellenada abajo.
          </span>
        </div>
      </li>

      <li className={styles.step}>
        <div className={styles.stepBody}>
          <span className={styles.stepTitle}>
            Abre PowerShell en el repositorio y cambia a la rama <code>{WORKER_BRANCH}</code>
          </span>
          <CodeBlock
            label="PowerShell"
            code={[
              "cd C:\\ruta\\a\\AM-TradingAgents",
              "git fetch origin",
              `git checkout ${WORKER_BRANCH}`,
              "git pull",
            ].join("\n")}
          />
          <span className={styles.stepText}>
            El worker solo existe en esta rama. Si <code>git checkout</code> se queja de cambios locales, guárdalos
            antes o usa un clon aparte. Repite <code>git pull</code> para actualizarlo.
            {compact && (
              <>
                {" "}
                Necesitas tu entorno de Python activado y <code>pip install -e .</code> hecho en esta rama; la guía
                completa está en Configuración → Worker local.
              </>
            )}
          </span>
        </div>
      </li>

      {!compact && (
        <li className={styles.step}>
          <div className={styles.stepBody}>
            <span className={styles.stepTitle}>Solo la primera vez: entorno de Python y dependencias</span>
            <CodeBlock
              label="PowerShell"
              code={["python -m venv .venv", ".\\.venv\\Scripts\\Activate.ps1", "pip install -e ."].join("\n")}
            />
            <span className={styles.stepText}>
              Si ya usas TradingAgents en este PC, activa tu entorno y ejecuta igualmente <code>pip install -e .</code>{" "}
              desde esta rama: instala sus dependencias y enlaza el paquete al repositorio, así cada{" "}
              <code>git pull</code> actualiza el worker sin reinstalar. Si PowerShell bloquea <code>Activate.ps1</code>,
              ejecuta antes <code>Set-ExecutionPolicy -Scope CurrentUser RemoteSigned</code>.
            </span>
          </div>
        </li>
      )}

      <li className={styles.step}>
        <div className={styles.stepBody}>
          <span className={styles.stepTitle}>
            Crea el archivo <code>.env</code> en la raíz del repositorio
          </span>
          <CodeBlock label="PowerShell" code="notepad .env" />
          <span className={styles.stepText}>
            Pega estas líneas, sustituye <code>PEGA_AQUI_TU_SERVICE_ROLE_KEY</code> por tu clave y guarda. Si el archivo
            ya existe, añádelas al final. <code>AM_WORKER_TENANT_IDS</code> (ya rellenado con el ID de tu workspace)
            evita que el worker ejecute análisis de otros workspaces. Para recibir los informes en español, quita el{" "}
            <code>#</code> de la última línea.
          </span>
          <CodeBlock label=".env (local, nunca en git)" code={envFile} />
        </div>
      </li>

      <li className={styles.step}>
        <div className={styles.stepBody}>
          <span className={styles.stepTitle}>Comprueba que llama-swap sirve el modelo</span>
          <CodeBlock label="PowerShell" code={`Invoke-RestMethod ${modelsUrl}`} />
          <span className={styles.stepText}>
            Debe listar <code>{deep}</code>
            {quick !== deep && (
              <>
                {" "}
                y <code>{quick}</code>
              </>
            )}
            .
          </span>
        </div>
      </li>

      <li className={styles.step}>
        <div className={styles.stepBody}>
          <span className={styles.stepTitle}>Arranca el worker</span>
          <CodeBlock label="PowerShell" code="python scripts/supabase_worker.py" />
          <span className={styles.stepText}>
            Déjalo abierto: revisa la cola cada {WORKER_DEFAULTS.pollSeconds} s y publica aquí los informes de cada
            agente. Usa <code>--once</code> para procesar un solo análisis y salir; <code>Ctrl+C</code> lo detiene. Con
            el kill switch activo no reclama análisis nuevos.
          </span>
        </div>
      </li>
    </ol>
  );
}
