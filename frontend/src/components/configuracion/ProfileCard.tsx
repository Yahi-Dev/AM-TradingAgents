import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatDate, shortId } from "@/lib/format";
import { ROLE_LABELS, isUserRole, type Profile, type Tenant } from "@/lib/types";

import styles from "./configuracion.module.css";

const PLAN_LABELS: Record<string, string> = {
  FREE: "Free · gratuito",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

export type ProfileCardProps = {
  email: string | null;
  profile: Profile;
  tenant: Tenant | null;
};

/** Datos del usuario y de su workspace (solo lectura). */
export function ProfileCard({ email, profile, tenant }: ProfileCardProps) {
  const role = isUserRole(profile.role) ? ROLE_LABELS[profile.role] : profile.role;
  return (
    <Card title="Perfil" subtitle="Tu usuario y tu workspace">
      <dl className={styles.dl}>
        <dt>Email</dt>
        <dd className="mono small">{email ?? profile.email ?? "—"}</dd>
        <dt>Nombre</dt>
        <dd>{profile.display_name?.trim() || <span className="subtle">Sin nombre visible</span>}</dd>
        <dt>Rol</dt>
        <dd>
          <Badge tone={profile.role === "ADMIN" ? "amber" : "neutral"} title={profile.role}>
            {role}
          </Badge>
        </dd>
        <dt>Workspace</dt>
        <dd>{tenant?.name ?? <span className="subtle">No disponible</span>}</dd>
        <dt>Plan</dt>
        <dd>
          {tenant ? (
            <Badge tone={tenant.plan === "FREE" ? "teal" : "info"} title={tenant.plan}>
              {PLAN_LABELS[tenant.plan] ?? tenant.plan}
            </Badge>
          ) : (
            "—"
          )}
        </dd>
        <dt>Alta</dt>
        <dd className="mono small">{formatDate(profile.created_at)}</dd>
        <dt>ID</dt>
        <dd className="mono small subtle" title={profile.id}>
          {shortId(profile.id)}
        </dd>
      </dl>
    </Card>
  );
}

/** Reglas no negociables de este despliegue, para que el owner las tenga a la vista. */
export function DeploymentGuaranteesCard() {
  const items: Array<{ title: string; text: string }> = [
    { title: "LIVE bloqueado.", text: "Solo BACKTEST, PAPER o SHADOW: lo impiden la base de datos y las RPC." },
    { title: "Sin broker ni OMS.", text: "Nada envía órdenes: la IA recomienda, nunca ordena." },
    {
      title: "Clave pública + tu sesión.",
      text: "La web nunca usa la service_role key; solo la usa el worker desde tu PC.",
    },
    { title: "Todo auditado.", text: "Los cambios de configuración y del kill switch quedan en la bitácora." },
    {
      title: "Sin chain-of-thought.",
      text: "Solo se guardan los informes estructurados de cada agente.",
    },
  ];
  return (
    <Card title="Garantías del despliegue" subtitle="Vercel Hobby + Supabase Free">
      <ul className={styles.guarantees}>
        {items.map((item) => (
          <li key={item.title}>
            <span className={styles.tick} aria-hidden="true">
              ✓
            </span>
            <span>
              <strong>{item.title}</strong> {item.text}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
