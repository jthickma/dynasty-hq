import { useState } from "react";
import { lookupTeam } from "../lib/teams";

interface Props {
  school: string | null | undefined;
  size?: number;
  className?: string;
  /** Fallback color dot if no logo matches. */
  fallbackColor?: string;
  title?: string;
}

export function TeamLogo({
  school,
  size = 24,
  className = "",
  fallbackColor,
  title,
}: Props) {
  const team = lookupTeam(school);
  const [failed, setFailed] = useState(false);

  if (!team || failed) {
    const initials = (school ?? "")
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
    return (
      <span
        className={`inline-grid place-items-center rounded shrink-0 text-[10px] font-bold text-black ${className}`}
        style={{
          width: size,
          height: size,
          background: fallbackColor ?? "var(--accent)",
        }}
        title={title ?? school ?? ""}
      >
        {initials || "?"}
      </span>
    );
  }

  return (
    <img
      src={team.logo}
      alt={team.name}
      width={size}
      height={size}
      title={title ?? team.name}
      onError={() => setFailed(true)}
      className={`inline-block object-contain shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
