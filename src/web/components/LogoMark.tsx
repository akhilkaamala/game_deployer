import { cn } from "../lib/utils";

interface LogoMarkProps {
  className?: string;
}

/** Inline animated logo — avoids broken paths when the app is deployed with a relative base URL. */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full", className)}
      aria-hidden
    >
      <style>
        {`
          @keyframes blaze-pulse {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-1px); }
          }
          @keyframes blaze-thrust {
            0%, 100% { opacity: 0.6; transform: scaleY(1); }
            50% { opacity: 1; transform: scaleY(1.2); }
          }
          @keyframes blaze-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .blaze-rocket { animation: blaze-pulse 2s ease-in-out infinite; transform-origin: center; }
          .blaze-thrust { animation: blaze-thrust 0.2s ease-in-out infinite; transform-origin: 16px 24px; }
          .blaze-orbit { animation: blaze-spin 4s linear infinite; transform-origin: 16px 16px; }
        `}
      </style>

      <circle
        cx="16"
        cy="16"
        r="15"
        fill="#09090b"
        stroke="#1e1e21"
        strokeWidth="1"
      />

      <circle
        className="blaze-orbit"
        cx="16"
        cy="16"
        r="12"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeDasharray="4 8"
        strokeLinecap="round"
        opacity="0.4"
      />

      <g className="blaze-rocket">
        <path
          d="M16 6C14 10 13 14 13 18C13 20 14 22 16 22C18 22 19 20 19 18C19 14 18 10 16 6Z"
          fill="#3b82f6"
        />
        <path d="M13 18L10 21V22H13V18Z" fill="#1d4ed8" />
        <path d="M19 18L22 21V22H19V18Z" fill="#1d4ed8" />
        <circle cx="16" cy="12" r="1.5" fill="#eff6ff" />
        <path
          className="blaze-thrust"
          d="M14 22L16 28L18 22H14Z"
          fill="url(#blazeThrustGradient)"
        />
      </g>

      <defs>
        <linearGradient
          id="blazeThrustGradient"
          x1="16"
          y1="22"
          x2="16"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
