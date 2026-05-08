"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ChatbotShell = dynamic(
  () => import("@/components/chatbot/chatbot-shell").then((m) => ({ default: m.ChatbotShell })),
  { ssr: false, loading: () => null },
);

const routes = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/finance", label: "Finance" },
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Accounts" },
  { href: "/strategy", label: "Strategy" },
  { href: "/settings", label: "Settings" },
];

function titleFromPath(pathname: string): string {
  const hit = routes.find((route) => pathname.startsWith(route.href));
  return hit?.label ?? "Noah Finance";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageTitle = titleFromPath(pathname);

  return (
    <>
      <div className="app-shell">
        <aside className="app-sidebar">
          <h1>Noah Finance</h1>
          <p>Phase 1 Foundation</p>
          <nav className="nav-list" aria-label="Primary">
            {routes.map((route) => {
              const active = pathname.startsWith(route.href);
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`nav-link${active ? " active" : ""}`}
                >
                  {route.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="app-main">
          <header className="app-header">
            <div>
              <h2>{pageTitle}</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
                Personal finance workspace.
              </p>
            </div>
          </header>
          <main className="page-body">{children}</main>
        </div>
      </div>
      <ChatbotShell />
    </>
  );
}
