"use client";

import type { ButtonHTMLAttributes } from "react";
import styles from "./button.module.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md";
};

export function Button({
  variant = "outline",
  size = "sm",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const variantClass = styles[variant] ?? styles.outline;
  const sizeClass = styles[size] ?? styles.sm;
  return (
    <button
      type={type}
      className={[styles.btn, variantClass, sizeClass, className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
