import type { SVGProps } from "react";

export type IconName =
  | "activity"
  | "arrow"
  | "bolt"
  | "check"
  | "chevron"
  | "close"
  | "copy"
  | "eye"
  | "file"
  | "grid"
  | "inbox"
  | "info"
  | "lock"
  | "mail"
  | "pause"
  | "play"
  | "plus"
  | "refresh"
  | "search"
  | "send"
  | "settings"
  | "shield"
  | "spark"
  | "ticket"
  | "trash"
  | "users"
  | "volume"
  | "volumeOff"
  | "warning"
  | "workflow";

export interface IconProps extends SVGProps<SVGSVGElement> {
  readonly name: IconName;
  readonly size?: number;
}

export function Icon({ name, size = 16, ...props }: IconProps) {
  const shared = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
  };

  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...shared}
      {...props}
    >
      {name === "activity" && <path d="M3 12h4l2.3-6 4.2 12 2.2-6H21" />}
      {name === "arrow" && <path d="m9 18 6-6-6-6" />}
      {name === "bolt" && <path d="m13 2-8 12h7l-1 8 8-12h-7z" />}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "chevron" && <path d="m8 10 4 4 4-4" />}
      {name === "close" && <path d="m6 6 12 12M18 6 6 18" />}
      {name === "copy" && (
        <>
          <rect height="12" rx="2" width="12" x="8" y="8" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </>
      )}
      {name === "eye" && (
        <>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
      {name === "file" && (
        <>
          <path d="M6 2h8l4 4v16H6z" />
          <path d="M14 2v5h5M9 12h6M9 16h6" />
        </>
      )}
      {name === "grid" && (
        <>
          <rect height="7" rx="1" width="7" x="3" y="3" />
          <rect height="7" rx="1" width="7" x="14" y="3" />
          <rect height="7" rx="1" width="7" x="3" y="14" />
          <rect height="7" rx="1" width="7" x="14" y="14" />
        </>
      )}
      {name === "inbox" && (
        <>
          <path d="M4 5h16l2 11v3H2v-3z" />
          <path d="M2 16h6l2 2h4l2-2h6" />
        </>
      )}
      {name === "info" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </>
      )}
      {name === "lock" && (
        <>
          <rect height="10" rx="2" width="14" x="5" y="11" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      )}
      {name === "mail" && (
        <>
          <rect height="14" rx="2" width="20" x="2" y="5" />
          <path d="m3 7 9 6 9-6" />
        </>
      )}
      {name === "pause" && <path d="M8 5v14M16 5v14" />}
      {name === "play" && <path d="m8 5 11 7-11 7z" />}
      {name === "plus" && <path d="M12 5v14M5 12h14" />}
      {name === "refresh" && (
        <>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5M19 12a7 7 0 0 0-12-5L4 10M5 12a7 7 0 0 0 12 5l3-3" />
        </>
      )}
      {name === "search" && (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 5 5" />
        </>
      )}
      {name === "send" && <path d="m22 2-8 20-4-8-8-4zM10 14 22 2" />}
      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9L1.1 5.9l.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z"
            transform="translate(2 0) scale(.83)"
          />
        </>
      )}
      {name === "shield" && (
        <path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5zM8.5 12l2.2 2.2 4.8-5" />
      )}
      {name === "spark" && (
        <path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6zM19 17l.6 2.4L22 20l-2.4.6L19 23l-.6-2.4L16 20l2.4-.6z" />
      )}
      {name === "ticket" && (
        <path d="M3 7a2 2 0 0 0 2-2h14v5a2 2 0 0 0 0 4v5H5a2 2 0 0 0-2-2zM9 8v8" />
      )}
      {name === "trash" && (
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
      )}
      {name === "users" && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" />
        </>
      )}
      {name === "volume" && (
        <path d="M4 10v4h4l5 4V6l-5 4zM17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />
      )}
      {name === "volumeOff" && (
        <path d="M4 10v4h4l5 4V6l-5 4zM17 10l5 5M22 10l-5 5" />
      )}
      {name === "warning" && <path d="M12 3 2 21h20zM12 9v5M12 17h.01" />}
      {name === "workflow" && (
        <>
          <rect height="5" rx="1" width="6" x="2" y="3" />
          <rect height="5" rx="1" width="6" x="16" y="16" />
          <rect height="5" rx="1" width="6" x="2" y="16" />
          <path d="M8 5.5h4a4 4 0 0 1 4 4v6.5M8 18.5h8" />
        </>
      )}
    </svg>
  );
}
