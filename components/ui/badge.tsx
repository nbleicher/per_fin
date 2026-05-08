"use client";

import type { HTMLAttributes } from "react";
import styles from "./badge.module.css";

export type BadgeTone = "brand" | "neutral" | "danger" | "success";

export function Badge({
  tone = "brand",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  const toneClass = styles[tone] ?? styles.brand;
  return (
    <span className={[styles.badge, toneClass, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </span>
  );
}
