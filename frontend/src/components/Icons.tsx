import type { SVGProps } from "react";

const I = (p: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    width={18}
    height={18}
    {...p}
  />
);

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M3 12 12 3l9 9" />
    <path d="M5 10v10h14V10" />
  </I>
);
export const RosterIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <circle cx={9} cy={8} r={4} />
    <path d="M2 21c0-4 3-7 7-7s7 3 7 7" />
    <circle cx={17} cy={6} r={3} />
    <path d="M22 19c0-3-2-5-5-5" />
  </I>
);
export const ScheduleIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <rect x={3} y={4} width={18} height={18} rx={2} />
    <path d="M3 10h18M8 2v4M16 2v4" />
  </I>
);
export const RecruitIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M12 2 14.5 8 21 9l-5 4 1 7-5-3-5 3 1-7-5-4 6.5-1z" />
  </I>
);
export const StatsIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 14l3-3 4 4 5-6" />
  </I>
);
export const ImportIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
    <path d="M3 17v3h18v-3" />
  </I>
);
export const SettingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <circle cx={12} cy={12} r={3} />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </I>
);
export const ChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="m6 9 6 6 6-6" />
  </I>
);
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M12 5v14M5 12h14" />
  </I>
);
export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </I>
);
export const SaveIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M5 3h11l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M7 3v5h9V3M7 21v-7h10v7" />
  </I>
);
export const StarIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M12 2 14.5 8 21 9l-5 4 1 7-5-3-5 3 1-7-5-4 6.5-1z" />
  </I>
);
export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <circle cx={11} cy={11} r={7} />
    <path d="m21 21-4.3-4.3" />
  </I>
);
export const XIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M6 6l12 12M6 18 18 6" />
  </I>
);
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M5 13l4 4L19 7" />
  </I>
);
