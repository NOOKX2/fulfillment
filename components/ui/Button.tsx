import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Use light outline/text when placed on an ink background. */
  onDark?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45";

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-14 px-5 text-base",
};

function variantClass(v: Variant, onDark: boolean): string {
  switch (v) {
    case "primary":
      return "bg-gold text-ink hover:brightness-95 active:brightness-90";
    case "secondary":
      return onDark
        ? "border border-white text-white hover:bg-white/10"
        : "border border-ink text-ink hover:bg-silver";
    case "ghost":
      return onDark ? "text-white hover:bg-white/10" : "text-ink hover:bg-silver";
    case "danger":
      return "bg-danger text-white hover:brightness-95";
  }
}

export function Button({
  variant = "primary",
  size = "md",
  onDark = false,
  className = "",
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`${base} ${sizes[size]} ${variantClass(variant, onDark)} ${className}`}
      {...rest}
    />
  );
}
