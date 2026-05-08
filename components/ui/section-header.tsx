"use client";

import styles from "./section-header.module.css";

export function SectionHeader({
  title,
  summary,
}: {
  title: string;
  summary?: string;
}) {
  return (
    <div className={styles.wrap}>
      <p className={styles.title}>{title}</p>
      {summary ? <p className={styles.summary}>{summary}</p> : null}
    </div>
  );
}
