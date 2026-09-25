import type { SVGProps } from "react";

import type { NavIcon } from "./nav";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

const PATHS: Record<NavIcon, React.ReactNode> = {
  panel: (
    <>
      <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="1.5" />
      <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
    </>
  ),
  agentes: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="5" cy="18" r="2.2" />
      <circle cx="19" cy="18" r="2.2" />
      <circle cx="12" cy="13" r="2.2" />
      <path d="M12 7.2v3.6M10.3 14.4l-3.6 2.3M13.7 14.4l3.6 2.3" />
    </>
  ),
  backtesting: (
    <>
      <path d="M9 3h6M10 3v6.2L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  portfolio: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6L12 3z" />
      <path d="M8.8 12.2l2.2 2.2 4.3-4.6" />
    </>
  ),
  auditoria: (
    <>
      <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14.5 3v4.5H19M8.5 12h7M8.5 15.5h7M8.5 8.5h3" />
    </>
  ),
  desarrollo: (
    <>
      <path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.2 4.5l-2.4 15" />
    </>
  ),
  configuracion: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </>
  ),
};

/** Icono de navegación del rail. */
export function NavIconSvg({ icon, ...rest }: IconProps & { icon: NavIcon }) {
  return <Svg {...rest}>{PATHS[icon]}</Svg>;
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function PowerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v8" />
      <path d="M6.4 6.9a8 8 0 1 0 11.2 0" />
    </Svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 16l-4-4 4-4M6 12h10" />
    </Svg>
  );
}
