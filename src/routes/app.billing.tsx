import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { Check, CreditCard, Download, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/billing")({
  beforeLoad: requireAuth,
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
  const { t } = useI18n();
  const [planOpen, setPlanOpen] = useState(false);
  const [seatsOpen, setSeatsOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);

  return (
    <AppShell title={t("side.billing")}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("side.billing")}</h1>
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPlanOpen(true)}>{t("common.changePlan")}</Button>
              <Button onClick={() => setSeatsOpen(true)} className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
                {t("common.addSeats")}
              </Button>
            </div>
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
            <Button variant="ghost" size="sm" onClick={() => setCardOpen(true)}>Edit</Button>
          </div>
          <Button variant="outline" className="mt-3 w-full" onClick={() => setCardOpen(true)}>Add new card</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold">{t("billing.billingHistory")}</h3>
            <Button variant="ghost" size="sm" onClick={() => toast.info("All mock invoices are already shown")}>{t("common.viewAll")}</Button>
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
                  <button
                    onClick={() => toast.success(`${inv.id} downloaded`)}
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
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
          <Button
            onClick={() => setPlanOpen(true)}
            className="mt-5 w-full bg-gradient-brand text-white shadow-glow hover:opacity-95"
          >
            Upgrade to Business
          </Button>
        </div>
      </div>

      <PlanDialog open={planOpen} onOpenChange={setPlanOpen} />
      <SeatsDialog open={seatsOpen} onOpenChange={setSeatsOpen} />
      <PaymentDialog open={cardOpen} onOpenChange={setCardOpen} />
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

function PlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>Select a mock plan for this demo session.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          {["Free", "Pro", "Business"].map((plan) => (
            <button
              key={plan}
              onClick={() => {
                onOpenChange(false);
                toast.success(`${plan} plan selected`);
              }}
              className="rounded-2xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="font-semibold">{plan}</div>
              <div className="mt-1 text-xs text-muted-foreground">Mock selection</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SeatsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add seats</DialogTitle>
          <DialogDescription>This only updates the demo interaction state.</DialogDescription>
        </DialogHeader>
        <Field label="Seats to add">
          <Input type="number" min="1" defaultValue="2" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast.success("Seats added");
            }}
            className="bg-gradient-brand text-white"
          >
            Add seats
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payment method</DialogTitle>
          <DialogDescription>Mock card fields for the frontend prototype.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Card number"><Input defaultValue="4242 4242 4242 4242" /></Field>
          </div>
          <Field label="Expiry"><Input defaultValue="09 / 28" /></Field>
          <Field label="CVC"><Input defaultValue="123" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast.success("Payment method saved");
            }}
            className="bg-gradient-brand text-white"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
