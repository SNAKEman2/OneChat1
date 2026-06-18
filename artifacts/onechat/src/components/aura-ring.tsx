import type { ReactNode } from "react";

export const AURAS = {
  calm: {
    label: "Calm",
    emoji: "🌊",
    gradient: "linear-gradient(135deg, #0096B2 0%, #00B4D8 100%)",
    solid: "#0096B2",
  },
  curious: {
    label: "Curious",
    emoji: "✨",
    gradient: "linear-gradient(135deg, #D4820A 0%, #F4A261 100%)",
    solid: "#D4820A",
  },
  reflective: {
    label: "Reflective",
    emoji: "🌙",
    gradient: "linear-gradient(135deg, #6B21A8 0%, #9333EA 100%)",
    solid: "#7C3AED",
  },
  optimistic: {
    label: "Optimistic",
    emoji: "🌱",
    gradient: "linear-gradient(135deg, #166534 0%, #16A34A 100%)",
    solid: "#16A34A",
  },
  passionate: {
    label: "Passionate",
    emoji: "🔥",
    gradient: "linear-gradient(135deg, #991B1B 0%, #DC2626 100%)",
    solid: "#DC2626",
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

export function AuraRing({ aura, size, children, ringWidth = 4 }: AuraRingProps) {
  if (!aura || !isValidAura(aura)) {
    return <>{children}</>;
  }

  const { gradient } = AURAS[aura];
  const gap = 2;

  return (
    <div
      className="flex-shrink-0 inline-flex items-center justify-center"
      style={{
        background: gradient,
        borderRadius: "50%",
        padding: ringWidth + gap,
        width: size + (ringWidth + gap) * 2,
        height: size + (ringWidth + gap) * 2,
      }}
    >
      <div
        style={{
          borderRadius: "50%",
          background: "var(--surface)",
          padding: gap,
          width: size + gap * 2,
          height: size + gap * 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
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
                    outline: selected ? "2.5px solid var(--foreground)" : "2.5px solid transparent",
                    outlineOffset: 3,
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
                borderRadius: 10,
                background: info.preview,
                border: selected
                  ? "2.5px solid var(--accent)"
                  : "2px solid var(--border)",
                transition: "border-color 0.15s ease, border-width 0.1s ease",
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
