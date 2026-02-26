import * as React from "react";

interface LogoProps {
  size?: number;
  className?: string;
  variant?: "mark" | "full" | "mono";
  title?: string;
}

export default function Logo({ size = 40, className = "", variant = "mark", title = "Learning Lab" }: LogoProps) {
  const gradientId = `cosmic-gradient`;
  const w = size;
  const h = size;

  const Mark = (
    <svg
      width={w}
      height={h}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-hidden={title ? "false" : "true"}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary) / 1)" />
          <stop offset="100%" stopColor="hsl(var(--accent) / 1)" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="120" height="120" rx="20" fill={`url(#${gradientId})`} />

      {/* central planet */}
      <g transform="translate(24 24)">
        <circle cx="36" cy="36" r="22" fill="rgba(255,255,255,0.10)" />

        {/* orbit ring */}
        <ellipse cx="36" cy="36" rx="34" ry="20" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" transform="rotate(-18 36 36)" />

        {/* stylized C path (Cosmic Classroom) */}
        <path
          d="M52 28c-6-8-18-10-28-6-6 2-10 6-12 12"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.98"
          fill="none"
          transform="translate(-2 2)"
        />

        {/* comet / star accent */}
        <g transform="translate(54 10) rotate(12)">
          <path d="M0 6 L8 0 L6 10 L14 14 L6 14 L4 22 L0 14 L-8 14 L-0 10 L-6 0 Z" fill="#fff" opacity="0.95" />
        </g>

        {/* small stars */}
        <circle cx="6" cy="56" r="1.5" fill="#fff" opacity="0.7" />
        <circle cx="64" cy="64" r="2.5" fill="#fff" opacity="0.8" />
      </g>
    </svg>
  );

  const Full = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }} className={className}>
      {Mark}
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontSize: Math.max(12, size / 3.5), fontWeight: 800 }}>Learning Lab</div>
        <div style={{ fontSize: Math.max(9, size / 6), color: "var(--muted-foreground, #94a3b8)" }}>K-12 Lessons — STEM & more</div>
      </div>
    </div>
  );

  const Mono = (
    <svg
      width={w}
      height={h}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-hidden={title ? "false" : "true"}
      aria-label={title}
    >
      <rect x="0" y="0" width="120" height="120" rx="20" fill="#111827" />
      <g transform="translate(24 24)" stroke="#FFFFFF" strokeWidth="2" fill="none">
        <circle cx="36" cy="36" r="22" />
        <ellipse cx="36" cy="36" rx="34" ry="20" transform="rotate(-18 36 36)" />
        <path d="M52 28c-6-8-18-10-28-6-6 2-10 6-12 12" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );

  if (variant === "full") return Full as unknown as JSX.Element;
  if (variant === "mono") return Mono as unknown as JSX.Element;
  return Mark as unknown as JSX.Element;
}
