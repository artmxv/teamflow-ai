import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Download, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/billing")({
  head: () => ({ meta: [{ title: "Billing — TeamFlow AI" }] }),
  component: BillingPage,
});

const invoices = [
  { id: "INV-2026-005", date: "May 1, 2026", amount: "$96.00", status: "Paid" },
  { id: "INV-2026-004", date: "Apr 1, 2026", amount: "$96.00", status: "Paid" },
  { id: "INV-2026-003", date: "Mar 1, 2026", amount: "$72.00", status: "Paid" },
  { id: "INV-2026-002", date: "Feb 1, 2026", amount: "$72.00", status: "Paid" },
  { id: "INV-2026-001", date: "Jan 1, 2026", amount: "$72.00", status: "Paid" },
];

function BillingPage() {
  return (
    <AppShell title="Billing">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Billing & plan</h1>
        <p className="text-sm text-muted-foreground">Manage your workspace subscription, usage, and invoices.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-soft lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" /> Pro plan
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">$12 / user / month</h2>
              <p className="text-sm text-muted-foreground">Billed monthly · 8 seats active</p>
            </div>
            <Button variant="outline">Change plan</Button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Next invoice" value="$96.00" sub="Jun 1, 2026" />
            <Stat label="AI credits used" value="1,340 / 2,000" sub="67%" />
            <Stat label="Seats" value="8 / 25" sub="Add more anytime" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CreditCard className="size-4 text-primary" /> Payment method
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-12 place-items-center rounded-md bg-gradient-brand text-[10px] font-semibold text-white">VISA</div>
              <div>
                <div className="text-sm font-medium">•••• 4242</div>
                <div className="text-xs text-muted-foreground">Expires 09 / 28</div>
              </div>
            </div>
            <Button variant="ghost" size="sm">Edit</Button>
          </div>
          <Button variant="outline" className="mt-3 w-full">Add new card</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold">Recent invoices</h3>
            <Button variant="ghost" size="sm">View all</Button>
          </div>
          <ul className="divide-y divide-border">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{inv.id}</div>
                  <div className="text-xs text-muted-foreground">{inv.date}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{inv.amount}</span>
                  <Badge variant="secondary" className="border-0 bg-success/15 text-success">{inv.status}</Badge>
                  <button className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <Download className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="text-base font-semibold">What's included</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {["Unlimited projects", "AI standups & summaries", "Advanced roles & permissions", "Priority support", "Audit log"].map((f) => (
              <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 size-4 text-primary" />{f}</li>
            ))}
          </ul>
          <Button className="mt-5 w-full bg-gradient-brand text-white shadow-glow hover:opacity-95">Upgrade to Business</Button>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
