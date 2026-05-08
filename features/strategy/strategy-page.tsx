"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RoadmapItem = {
  id: string;
  when: string;
  target: string;
  strategy: string;
  tips?: string[];
  tasks: string[];
};

const STORAGE_KEY = "credit_roadmap_v1";

const foundationRevenueTasks = [
  "Confirm $7,200+/mo gross revenue baseline (current)",
  "Set up dedicated JAWNIX business checking (separate from personal)",
  "Use QuickBooks / Wave to track revenue (needed for Chase Ink app)",
  "Maintain through September 2026 (Chase Ink underwriting checkpoint)",
  "Maintain through ~Nov 2026 (Amex Blue Business Plus checkpoint)",
];

const personalRoadmap: RoadmapItem[] = [
  {
    id: "p-may26",
    when: "May 2026",
    target: "Midland Settlement (Pay-for-Delete)",
    strategy:
      "CRITICAL: Pay-for-Delete agreement must be IN WRITING on Midland letterhead BEFORE any money moves.",
    tips: [
      "<strong>Why PFD works on Midland:</strong> they're a debt buyer who paid 4–15¢ per dollar of face value. Any payment is profit, so they'll often agree to delete in exchange for getting paid.",
      "<strong>Required language:</strong> \"Midland will request deletion from all 3 bureaus upon receipt of payment.\" Not \"update to paid.\"",
      "<strong>If they refuse PFD:</strong> send a debt validation letter under FDCPA §809 within 30 days. Demand the original signed contract, full account statements, and proof of assignment.",
      "<strong>Florida SOL:</strong> 5 years for unsecured debt lawsuits. Midland can still report (7-yr FCRA window) but legally can't sue you.",
    ],
    tasks: [
      "Call Midland — confirm payoff balance + get rep name/ID",
      "Request PFD agreement in writing on Midland letterhead",
      "Verify letter says: \"Midland will request deletion from all 3 bureaus upon receipt of payment\"",
      "Get agreement emailed AND mailed before paying anything",
      "IF MIDLAND REFUSES PFD IN WRITING → STOP, do not pay",
      "Once written PFD in hand: pay full settlement via traceable method (cashier's check)",
      "Receive and save the \"Paid in Full\" letter",
      "Mail copies of PFD + payment proof to all 3 bureaus (certified)",
      "Re-pull bureau reports 30 days post-payment to confirm deletion",
      "If still showing after 45 days: file CFPB complaint citing written PFD agreement",
    ],
  },
  {
    id: "p-jun26",
    when: "June 2026",
    target: "Verification & Credit Limit Increases",
    strategy:
      "Confirm Midland is gone. Then capitalize on the score jump by requesting CLIs to lower utilization.",
    tips: [
      "<strong>Pull type matters:</strong> Discover and Navy Fed almost always SOFT-pull for CLI — costs nothing. Capital One almost always HARD-pulls.",
      "<strong>Time CLI requests after Midland deletion posts</strong> (2–4 weeks after PFD payment).",
      "<strong>Ask BIG:</strong> Lenders often counter-offer at half. Asking for 3x usually nets 1.5–2x.",
    ],
    tasks: [
      "Pull all 3 bureau reports — confirm Midland is deleted",
      "Dispute any remaining stragglers",
      "Request CLI on Navy Federal",
      "Request CLI on Discover",
      "Request CLI on Capital One Quicksilver",
      "Log new total available credit + new utilization %",
    ],
  },
  {
    id: "p-jul26",
    when: "July 2026",
    target: "Score Verification",
    strategy:
      "No new applications. Pull all 3 bureaus, lock in the FICO baseline before the August Amex app.",
    tasks: [
      "Pull Equifax, Experian, TransUnion reports",
      "Verify Midland is gone from all 3",
      "Verify CLI increases posted from June",
      "Pull FICO 8 score (Discover/Navy Fed free portal)",
      "Document new score baseline + utilization %",
      "Freeze Innovis and ChexSystems (optional — reduces fraud risk)",
    ],
  },
  {
    id: "p-aug26",
    when: "August 2026",
    target: "Amex Gold + Navy Fed Graduation",
    strategy:
      "Two-track month: apply for Amex Gold (4x dining/groceries) AND graduate the Feb '26 Navy Fed secured card.",
    tasks: [
      "— Amex Gold —",
      "Confirm FICO is 700+",
      "Check Amex pre-qual page",
      "Apply for Amex Gold",
      "Hit the welcome offer minimum spend on dining/groceries",
      "Set Gold as default for restaurants and supermarkets",
      "— Navy Fed Graduation —",
      "Confirm 6 on-time payments are reported",
      "Call Navy Fed and request graduation to nRewards/CashRewards unsecured",
      "Confirm security deposit refund timeline",
      "Verify card converts (not closed + reopened)",
    ],
  },
  {
    id: "p-sep26",
    when: "September 2026",
    target: "Navy Fed Flagship",
    strategy:
      "The \"High Limit\" card: 3x on travel, free Amazon Prime credit, targets $10k+ limit.",
    tasks: [
      "Verify 90+ days since last hard pull",
      "Apply for Navy Fed Flagship Rewards",
      "Push for $10k+ starting limit",
      "Enroll in Amazon Prime statement credit",
      "Set Flagship as default for travel bookings",
    ],
  },
  {
    id: "p-oct26",
    when: "October 2026",
    target: "Fidelity Visa",
    strategy:
      "2% cash back deposited directly into Fidelity Brokerage/CMA. Bilt deferred to January 2027.",
    tasks: [
      "Open Fidelity CMA or Brokerage account if not already",
      "Apply for Fidelity Rewards Visa Signature",
      "Set rewards destination to brokerage account",
      "Designate as the \"everything else\" misc card",
      "Plan to product-change Quicksilver (do not close)",
    ],
  },
  {
    id: "p-jan27",
    when: "January 2027",
    target: "Flagler Village Move + Bilt (if moving)",
    strategy:
      "IF the move happens: sign Flagler Village lease and apply for Bilt Mastercard concurrently.",
    tasks: [
      "— Move decision —",
      "Decide: moving to Flagler Village or staying?",
      "IF NOT MOVING: skip remainder, top up emergency fund",
      "— If moving —",
      "Call Flagler Village: confirm they accept Bilt direct payment",
      "Sign lease",
      "Apply for Bilt Mastercard (Wells Fargo issuer)",
      "Link rent payment to Bilt",
      "Update address with all 3 bureaus + every card issuer",
      "Set up renters insurance",
      "Confirm first rent payment posts to Bilt and earns points",
    ],
  },
  {
    id: "p-mar27",
    when: "March 2027",
    target: "Capital One Venture X — \"Final Boss\"",
    strategy:
      "2x miles on everything, Priority Pass lounge access, $300 travel credit.",
    tasks: [
      "Confirm 12 months clean payment history",
      "Confirm FICO 740+",
      "Confirm no new accounts in last 60 days",
      "Apply for Venture X",
      "Activate Priority Pass membership",
      "Book first $300 travel credit",
      "Add authorized users (free Priority Pass for each)",
    ],
  },
  {
    id: "p-jun27",
    when: "June 2027",
    target: "Citi Costco Anywhere Visa + Citi AA",
    strategy:
      "4% gas at Costco, AA perks (free checked bags). Re-entry into the Citi ecosystem.",
    tasks: [
      "Confirm active Costco membership",
      "Apply for Citi Costco Anywhere Visa",
      "Apply for Citi AA card (separate day, separate inquiry)",
      "Set Costco Visa as default for gas",
      "Add AA card to AA app for free checked bag perk",
    ],
  },
];

const loanRoadmap: RoadmapItem[] = [
  {
    id: "sl-may26",
    when: "May 2026",
    target: "Mail Retro-Forbearance Request (Nelnet / EdFin)",
    strategy:
      "Request retroactive forbearance covering the family-emergency period.",
    tasks: [
      "Gather documentation of family emergency",
      "Draft retro-forbearance letter citing Title IV extenuating circumstances",
      "Mail to Nelnet — certified, return receipt",
      "Mail to EdFin — certified, return receipt",
      "Save tracking numbers + copies",
      "Get pre-qualified with SoFi (soft pull)",
      "Get pre-qualified with Navy Federal (soft pull for existing members)",
      "Document both rate quotes — use as refi leverage if EdFin denies",
    ],
  },
  {
    id: "sl-jun26",
    when: "June 2026",
    target: "Mail Discover Goodwill Letter",
    strategy:
      "Request Discover remove the late marks as a one-time courtesy. ~10–20% goodwill success rate.",
    tasks: [
      "Pull Discover account history (confirm specific late dates)",
      "Draft goodwill letter — concise, no excuses",
      "Mail to Discover Executive Office: PO Box 30943, Salt Lake City, UT 84130 (certified)",
      "Submit via secure message in Discover app (parallel)",
      "Polite Twitter/X reply to @Discover",
      "Save copies + tracking numbers for all 3 channels",
    ],
  },
  {
    id: "sl-jul26",
    when: "July 2026",
    target: "Follow Up on Forbearance Approval",
    strategy:
      "Two months in — check status with both servicers.",
    tasks: [
      "Call Nelnet — get status update + name/employee ID",
      "Call EdFin — same",
      "If approved: confirm in writing + verify bureau reporting updated",
      "If pending: get committed decision date",
      "If denied: prepare CFPB complaint",
    ],
  },
  {
    id: "sl-aug26",
    when: "August 2026",
    target: "If Denied: File CFPB Complaint",
    strategy:
      "Escalation month. File formal CFPB complaints at consumerfinance.gov/complaint.",
    tasks: [
      "Go to consumerfinance.gov/complaint",
      "File separate complaint per lender that denied",
      "Cite \"extenuating circumstances\" + attach documentation",
      "Upload retro-forbearance letter + denial response",
      "Track complaint number — expect response within 15 business days",
    ],
  },
  {
    id: "sl-oct26",
    when: "October 2026",
    target: "Verify 2025 Lates Are Removed",
    strategy:
      "Audit month. Pull all 3 bureaus and confirm every 2025 late mark is corrected.",
    tasks: [
      "Pull Equifax, Experian, TransUnion reports",
      "Check each loan + Discover account for 2025 lates",
      "For any remaining: file formal dispute citing CFPB complaint resolution",
      "Re-pull reports 30 days after dispute",
    ],
  },
  {
    id: "sl-jan27",
    when: "January 2027",
    target: "All \"Lates\" Should Be Neutralized",
    strategy: "Final verification before Tesla lease + Flagler move.",
    tasks: [
      "Pull all 3 bureau reports one final time",
      "Confirm zero 2025 lates on Nelnet, EdFin, Discover",
      "Pull FICO Auto Score 8/9 (what Tesla will pull)",
      "If any lates remain — pause Tesla lease, escalate to attorney general",
    ],
  },
];

const businessRoadmap: RoadmapItem[] = [
  {
    id: "b-1",
    when: "Phase 1 · May 2026",
    target: "Register D-U-N-S Number",
    strategy:
      "Mandatory business ID for credit tracking. Register immediately — it's free.",
    tasks: [
      "Confirm JAWNIX LLC is in good standing with the state",
      "Register for D-U-N-S Number on dnb.com (free option)",
      "Wait for D-U-N-S confirmation (~30 days standard)",
      "Save D-U-N-S number in password manager",
    ],
  },
  {
    id: "b-2",
    when: "Phase 2 · June 2026",
    target: "Open Net-30 Vendor Accounts",
    strategy:
      "Open accounts with Uline / Quill / Grainger. These will be the first 3 tradelines.",
    tasks: [
      "Open Uline net-30 account",
      "Open Quill net-30 account",
      "Open Grainger or Crown Office Supplies (3rd tradeline)",
    ],
  },
  {
    id: "b-2b",
    when: "Phase 2.5 · July 2026",
    target: "First Vendor Spend",
    strategy:
      "Activate tradelines with real orders. Pay in 10 days (not 30) to build perfect-payment history fast.",
    tasks: [
      "Place small order from Uline (~$60+)",
      "Place small order from Quill (~$60+)",
      "Place small order from Grainger (~$60+)",
      "Pay each invoice within 10 days",
      "Repeat monthly for 3 months minimum",
    ],
  },
  {
    id: "b-3",
    when: "Phase 3 · August 2026",
    target: "Navy Fed Business — \"Biz Go\"",
    strategy:
      "Leverage existing personal Navy Fed relationship for a $5k–$15k business line of credit.",
    tasks: [
      "Confirm 3 net-30 tradelines are reporting",
      "Schedule appointment with Navy Fed business banker",
      "Bring: EIN letter, articles of org, operating agreement, D-U-N-S, last 2 yr returns",
      "Apply for business line of credit ($5k–$15k target)",
      "Apply for Navy Fed Business credit card same visit",
    ],
  },
  {
    id: "b-5",
    when: "Phase 4 (moved up) · September 2026",
    target: "Chase Ink Unlimited",
    strategy:
      "1.5% cash back + large sign-up bonus. Apply in September while still at 3/24 — before October hits 5/24.",
    tasks: [
      "Confirm personal FICO is 720+",
      "Confirm under 5/24",
      "Confirm JAWNIX revenue still tracking $7,200+/mo",
      "Pull updated business profile from D&B + Experian Business",
      "Apply EARLY in September at chase.com/inkbusinessunlimited",
      "Use JAWNIX LLC + EIN; report $86k+ annualized revenue",
      "Push for $10k+ starting limit",
      "If approved low — call recon: 1-888-270-2127",
      "Hit ~$6k welcome offer minimum spend by end of November",
      "Set Chase Ink as default for ALL JAWNIX business expenses",
    ],
  },
  {
    id: "b-4",
    when: "Phase 5 · ~Nov 2026",
    target: "Amex Blue Business Plus",
    strategy:
      "Best overall biz card: 2x MR points on everything (first $50k/yr), no annual fee, no personal credit report.",
    tasks: [
      "Confirm 6+ months of business history with revenue",
      "Apply for Amex Blue Business Plus",
      "Hit welcome offer minimum spend",
      "Pool MR points with personal Amex Gold for transfer partners",
    ],
  },
];

const currentCards = [
  "Discover It — 5% rotating categories ($1.5k cap), Cashback Match Year 1",
  "NFCU CashRewards (Secured) — 1.5% cash back, graduation target Aug 2026",
  "Capital One Quicksilver — 1.5% cash back",
  "Capital One VentureOne — 1.25x miles",
];

const plannedCards = [
  "Amex Gold (Aug 2026)",
  "Chase Ink Unlimited (Sep 2026)",
  "NFCU Flagship Rewards (Sep 2026)",
  "Fidelity Rewards Visa (Oct 2026)",
  "Amex Blue Business Plus (~Nov 2026)",
  "Bilt Mastercard (Jan 2027 if moving)",
  "Capital One Venture X (Mar 2027)",
  "Citi Costco Anywhere Visa (Jun 2027)",
  "Citi AA Platinum Select (Jun 2027)",
];

const rewardMap = [
  { cat: "Rent", card: "Bilt Mastercard", perk: "1x → transfer to AA/Hyatt" },
  { cat: "Dining & Groceries", card: "Amex Gold", perk: "4x Membership Rewards" },
  { cat: "5% Rotating (Q1-Q4)", card: "Discover It", perk: "5% on quarterly category ($1.5k cap)" },
  { cat: "Gas & Costco", card: "Citi Costco Visa", perk: "4% cash back on gas" },
  { cat: "Business (JAWNIX)", card: "Amex Blue Business Plus", perk: "2x MR (pools with Gold)" },
  { cat: "Travel & Lounges", card: "Capital One Venture X", perk: "2x miles + Priority Pass" },
  { cat: "AA Flights", card: "Citi AA Platinum", perk: "2x + free checked bag" },
  { cat: "Everything Else", card: "Fidelity Visa", perk: "2% cash back to brokerage" },
];

export function StrategyPage() {
  const [activeTab, setActiveTab] = useState<
    "foundation" | "personal" | "loans" | "business" | "rewards"
  >("personal");
  const [emergencyFund, setEmergencyFund] = useState("");
  const [monthlyExpenses, setMonthlyExpenses] = useState("4500");
  const [checkState, setCheckState] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
        string,
        boolean
      >;
    } catch {
      return {};
    }
  });

  const setChecked = (key: string, value: boolean) => {
    setCheckState((prev) => {
      const next = { ...prev, [key]: value };
      if (!value) {
        delete next[key];
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const allRoadmapItems = useMemo(
    () => [...personalRoadmap, ...loanRoadmap, ...businessRoadmap],
    [],
  );

  const totalTasks = allRoadmapItems.reduce((sum, item) => {
    const tasks = item.tasks.filter((task) => !task.startsWith("— "));
    return sum + tasks.length;
  }, 0);
  const doneTasks = allRoadmapItems.reduce((sum, item) => {
    const tasks = item.tasks.filter((task) => !task.startsWith("— "));
    return sum + tasks.filter((_, idx) => checkState[`${item.id}-${idx}`]).length;
  }, 0);

  const efCurrent = Number(emergencyFund) || 0;
  const expenses = Number(monthlyExpenses) || 0;
  const efTarget = expenses * 6;
  const efPct = efTarget > 0 ? Math.min(100, (efCurrent / efTarget) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card title="Credit Roadmap" description="Master Credit Strategy 2026–2027">
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "var(--surface)",
            padding: "0.65rem 0.8rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <strong>Overall progress</strong>
            <span>
              {doneTasks} / {totalTasks} tasks
            </span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: "#e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: totalTasks ? `${(doneTasks / totalTasks) * 100}%` : "0%",
                height: "100%",
                background: "linear-gradient(90deg, var(--brand), #a78bfa)",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {[
            { id: "foundation", label: "Foundation" },
            { id: "personal", label: "Personal Credit" },
            { id: "loans", label: "Student Loans" },
            { id: "business", label: "JAWNIX Business" },
            { id: "rewards", label: "Reward Map" },
          ].map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={activeTab === tab.id ? "outline" : "ghost"}
              size="sm"
              onClick={() =>
                setActiveTab(
                  tab.id as "foundation" | "personal" | "loans" | "business" | "rewards",
                )
              }
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === "foundation" ? (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <RoadmapBlock
              title="Foundation"
              subtitle="The financial base that makes the rest of the plan safe to execute."
            />
            <Card
              title="Emergency Fund"
              description="6-month buffer · Target = 6 × monthly expenses"
            >
              <div style={{ display: "grid", gap: 8 }}>
                <div className="ui-field-grid ui-field-grid--pair">
                  <label className="ui-label">
                    Current balance
                    <input
                      className="ui-input"
                      type="number"
                      value={emergencyFund}
                      onChange={(e) => setEmergencyFund(e.target.value)}
                    />
                  </label>
                  <label className="ui-label">
                    Monthly expenses
                    <input
                      className="ui-input"
                      type="number"
                      value={monthlyExpenses}
                      onChange={(e) => setMonthlyExpenses(e.target.value)}
                    />
                  </label>
                </div>
                <div>
                  Current: ${efCurrent.toFixed(0)} of ${efTarget.toFixed(0)} ({efPct.toFixed(1)}%)
                </div>
              </div>
            </Card>

            <Card
              title="JAWNIX Revenue Baseline"
              description="$7,200/mo minimum · $86,400+ annualized"
            >
              <Checklist
                idPrefix="foundation"
                tasks={foundationRevenueTasks}
                checkState={checkState}
                setChecked={setChecked}
              />
            </Card>
          </div>
        ) : null}

        {activeTab === "personal" ? (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <RoadmapBlock
              title="Section 1 · Personal Credit Rebuild"
              subtitle="Optimized for FICO jump by prioritizing the Midland deletion and strategic application spacing."
            />
            {personalRoadmap.map((item) => (
              <RoadmapItemCard
                key={item.id}
                item={item}
                checkState={checkState}
                setChecked={setChecked}
              />
            ))}
          </div>
        ) : null}

        {activeTab === "loans" ? (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <RoadmapBlock
              title="Student Loans & Admin Cleanup"
              subtitle="Parallel track to remove the 2025 lates and clean up admin issues from the family emergency."
            />
            <Card
              title="Backup Plan: CFPB Complaint"
              description='If Nelnet or Discover rejects the "Goodwill" approach, file at consumerfinance.gov/complaint — lenders typically respond within 15 days because CFPB complaints become part of a public record.'
            />
            {loanRoadmap.map((item) => (
              <RoadmapItemCard
                key={item.id}
                item={item}
                checkState={checkState}
                setChecked={setChecked}
              />
            ))}
          </div>
        ) : null}

        {activeTab === "business" ? (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <RoadmapBlock
              title="Section 2 · JAWNIX LLC Business Credit"
              subtitle="Building a standalone business profile to protect personal assets and separate liabilities."
            />
            {businessRoadmap.map((item) => (
              <RoadmapItemCard
                key={item.id}
                item={item}
                checkState={checkState}
                setChecked={setChecked}
              />
            ))}
          </div>
        ) : null}

        {activeTab === "rewards" ? (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <RoadmapBlock
              title="Card Stack & Rewards"
              subtitle="Full wallet view: cards you have today plus every card in the application pipeline."
            />
            <Card title={`In Wallet Today (${currentCards.length})`}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {currentCards.map((card) => (
                  <li key={card} style={{ marginBottom: 4 }}>
                    {card}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title={`Application Pipeline (${plannedCards.length})`}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {plannedCards.map((card) => (
                  <li key={card} style={{ marginBottom: 4 }}>
                    {card}
                  </li>
                ))}
              </ul>
            </Card>
            <Card
              title="End-Game Reward Map"
              description="Where each dollar should land once the full stack is open."
            >
              <div className="ui-field-grid">
                {rewardMap.map((row) => (
                  <div
                    key={row.cat}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      background: "var(--surface)",
                      padding: "0.55rem 0.7rem",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{row.cat}</div>
                    <div style={{ fontWeight: 600 }}>{row.card}</div>
                    <div style={{ fontSize: 13 }}>{row.perk}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        <div style={{ marginTop: 10 }}>
          <Button
            variant="destructive"
            size="md"
            type="button"
            onClick={() => {
              setCheckState({});
              if (typeof window !== "undefined") {
                window.localStorage.removeItem(STORAGE_KEY);
              }
            }}
          >
            Reset all progress
          </Button>
        </div>
      </Card>
    </div>
  );
}

function RoadmapBlock({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>{title}</h3>
      <p style={{ margin: 0, color: "var(--text-muted)" }}>{subtitle}</p>
    </div>
  );
}

function RoadmapItemCard({
  item,
  checkState,
  setChecked,
}: {
  item: RoadmapItem;
  checkState: Record<string, boolean>;
  setChecked: (key: string, value: boolean) => void;
}) {
  const actionableTasks = item.tasks.filter((task) => !task.startsWith("— "));
  const doneCount = actionableTasks.reduce(
    (sum, _, idx) => sum + (checkState[`${item.id}-${idx}`] ? 1 : 0),
    0,
  );

  return (
    <Card
      title={`${item.when} — ${item.target}`}
      description={`${item.strategy} (${doneCount}/${actionableTasks.length} tasks)`}
    >
      {item.tips?.length ? (
        <div
          style={{
            border: "1px solid #fde68a",
            background: "#fffbeb",
            borderRadius: 8,
            padding: "0.55rem 0.65rem",
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Pro Tips</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {item.tips.map((tip) => (
              <li key={tip} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: tip }} />
            ))}
          </ul>
        </div>
      ) : null}

      <Checklist idPrefix={item.id} tasks={item.tasks} checkState={checkState} setChecked={setChecked} />
    </Card>
  );
}

function Checklist({
  idPrefix,
  tasks,
  checkState,
  setChecked,
}: {
  idPrefix: string;
  tasks: string[];
  checkState: Record<string, boolean>;
  setChecked: (key: string, value: boolean) => void;
}) {
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
      {tasks.map((task, idx) => {
        if (task.startsWith("— ")) {
          return (
            <li
              key={`${idPrefix}-${task}`}
              style={{
                marginTop: 8,
                marginBottom: 4,
                fontSize: 12,
                textTransform: "uppercase",
                color: "var(--text-muted)",
                fontWeight: 700,
              }}
            >
              {task.replace(/^—\s*/, "").replace(/\s*—$/, "")}
            </li>
          );
        }
        const taskIndex = tasks
          .slice(0, idx + 1)
          .filter((value) => !value.startsWith("— ")).length - 1;
        const key = `${idPrefix}-${taskIndex}`;
        return (
          <li key={key} style={{ marginBottom: 6 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={Boolean(checkState[key])}
                onChange={(e) => setChecked(key, e.target.checked)}
              />
              <span>{task}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
