import type { ReactNode } from "react";

export const AURAS = {
  calm: {
    label: "Calm",
    emoji: "🌊",
    gradient: "linear-gradient(135deg, #4ECDC4 0%, #A8EDEA 100%)",
    solid: "#4ECDC4",
  },
  curious: {
    label: "Curious",
    emoji: "✨",
    gradient: "linear-gradient(135deg, #FFB347 0%, #FFD590 100%)",
    solid: "#FFB347",
  },
  reflective: {
    label: "Reflective",
    emoji: "🌙",
    gradient: "linear-gradient(135deg, #A78BFA 0%, #DDD6FE 100%)",
    solid: "#A78BFA",
  },
  optimistic: {
    label: "Optimistic",
    emoji: "🌱",
    gradient: "linear-gradient(135deg, #6BCB77 0%, #B2F2BB 100%)",
    solid: "#6BCB77",
  },
  passionate: {
    label: "Passionate",
    emoji: "🔥",
    gradient: "linear-gradient(135deg, #FF6B6B 0%, #FFA0A0 100%)",
    solid: "#FF6B6B",
  },
} as const;

export type AuraType = keyof typeof AURAS;

export function isValidAura(value: string | null | undefined): value is AuraType {
  return !!value && value in AURAS;
}

interface AuraRingProps {
  aura?: AuraType | string | null;
  size: number;
  children: ReactNode;
  ringWidth?: number;
}

export function AuraRing({ aura, size, children, ringWidth = 3 }: AuraRingProps) {
  if (!aura || !isValidAura(aura)) {
    return <>{children}</>;
  }

  const { gradient } = AURAS[aura];

  return (
    <div
      className="flex-shrink-0 inline-flex"
      style={{
        background: gradient,
        borderRadius: "50%",
        padding: ringWidth,
        width: size + ringWidth * 2,
        height: size + ringWidth * 2,
      }}
    >
      {children}
    </div>
  );
}

interface AuraPickerProps {
  value: AuraType | null;
  onChange: (aura: AuraType | null) => void;
}

export function AuraPicker({ value, onChange }: AuraPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 flex-wrap">
        {(Object.entries(AURAS) as [AuraType, (typeof AURAS)[AuraType]][]).map(
          ([key, info]) => {
            const selected = value === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(selected ? null : key)}
                className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
                aria-label={`${info.label} aura${selected ? " (selected)" : ""}`}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: info.gradient,
                    outline: selected ? "2px solid var(--foreground)" : "2px solid transparent",
                    outlineOffset: 2,
                    transition: "outline-color 0.15s ease",
                  }}
                />
                <span
                  className="text-[10px] font-mono"
                  style={{ color: selected ? "var(--foreground)" : "var(--muted)" }}
                >
                  {info.label}
                </span>
              </button>
            );
          }
        )}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs font-mono self-start transition-opacity active:opacity-60"
          style={{ color: "var(--muted)" }}
        >
          Clear aura
        </button>
      )}
    </div>
  );
}

interface ThemePickerInlineProps {
  themes: Record<string, { label: string; description: string; preview: string; surface: string }>;
  value: string;
  onChange: (theme: string) => void;
}

export function ThemePickerInline({ themes, value, onChange }: ThemePickerInlineProps) {
  return (
    <div className="flex gap-3">
      {Object.entries(themes).map(([id, info]) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex flex-col items-center gap-1.5 flex-1 transition-transform active:scale-95"
          >
            <div
              style={{
                width: "100%",
                height: 40,
                borderRadius: 8,
                background: info.preview,
                border: selected
                  ? "2px solid var(--accent)"
                  : "2px solid var(--border)",
                transition: "border-color 0.15s ease",
              }}
            />
            <span
              className="text-[10px] font-mono text-center leading-tight"
              style={{ color: selected ? "var(--foreground)" : "var(--muted)" }}
            >
              {info.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
