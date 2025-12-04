// app/admin/reconciliation/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PaystackTransactionData } from "@/lib/paystack";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface OrphanPaymentDto {
  id: string;
  reference: string;
  amount: number; // in lowest denomination (e.g. kobo)
  currency: string;
  payload: unknown;
  firstSeenAt: string;
  reconciled: boolean;
  reconciledAt: string | null;
  resolutionNote: string | null;
}

/* -------------------------------------------------------------------------- */
/*                               Reconciliation                               */
/* -------------------------------------------------------------------------- */

export default function ReconciliationPage() {
  const router = useRouter();

  const [orphans, setOrphans] = useState<OrphanPaymentDto[]>([]);
  const [loadingOrphans, setLoadingOrphans] = useState(false);

  const [selected, setSelected] = useState<OrphanPaymentDto | null>(null);
  const [tx, setTx] = useState<PaystackTransactionData | null>(null);
  const [loadingTx, setLoadingTx] = useState(false);

  async function loadOrphans() {
    try {
      setLoadingOrphans(true);
      const res = await fetch("/api/admin/orphans");
      if (!res.ok) return;
      const json = await res.json();
      setOrphans((json.data || []) as OrphanPaymentDto[]);
    } finally {
      setLoadingOrphans(false);
    }
  }

  useEffect(() => {
    loadOrphans();
  }, []);

  async function verify(reference: string) {
    try {
      setLoadingTx(true);
      const res = await fetch(`/api/admin/orphans/${reference}/verify`);
      const json = await res.json();
      setTx((json.data || null) as PaystackTransactionData | null);
    } finally {
      setLoadingTx(false);
    }
  }

  async function resolve(reference: string) {
    await fetch(`/api/admin/orphans/${reference}/resolve`, {
      method: "POST",
    });
    await loadOrphans();
    // If this orphan was open in the dialog, close it
    setSelected((prev) => (prev?.reference === reference ? null : prev));
  }

  const closeDialog = () => {
    setSelected(null);
    setTx(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Payment Reconciliation
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Review Paystack-confirmed payments that didn&apos;t auto-create
          orders. You can verify them live or mark them as resolved. To create
          an order from a payment, use the Log Offline Sale page.
        </p>
      </div>

      <Separator />

      <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b px-4 py-3 sm:px-6">
          <h2 className="text-sm font-semibold">Orphan payments</h2>
          <p className="text-xs text-gray-500">
            Payments captured by Paystack but not attached to an order yet.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Reference</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Currency</th>
                <th className="px-4 py-2 font-medium">First seen</th>
                <th className="px-4 py-2 font-medium">Note</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingOrphans ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    Loading orphan payments…
                  </td>
                </tr>
              ) : orphans.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No orphan payments pending reconciliation.
                  </td>
                </tr>
              ) : (
                orphans.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">
                      {o.reference}
                    </td>
                    <td className="px-4 py-2">
                      ₦{(o.amount / 100).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">{o.currency}</td>
                    <td className="px-4 py-2">
                      {new Date(o.firstSeenAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {o.resolutionNote || "—"}
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelected(o);
                          verify(o.reference);
                        }}
                      >
                        Verify live
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolve(o.reference)}
                      >
                        Mark resolved
                      </Button>

                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/admin/log-sale?source=reconciliation&reference=${encodeURIComponent(
                              o.reference
                            )}&amount=${o.amount}&currency=${o.currency}`
                            // even if OfflineSaleForm ignores these now,
                            // they’re ready for future prefill.
                          )
                        }
                      >
                        Create order
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t px-4 py-3 text-center text-xs text-gray-400">
          Only payments that need manual attention will appear here.
        </div>
      </section>

      {/* Slim dialog: payment summary + live Paystack transaction only */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reconcile payment</DialogTitle>
          </DialogHeader>

          {!selected ? (
            <div className="text-sm text-gray-500">No payment selected.</div>
          ) : (
            <div className="space-y-4">
              {/* Payment summary card */}
              <section className="rounded-md bg-gray-50 p-3 text-xs space-y-1 border">
                <div>
                  <span className="font-semibold">Reference:</span>{" "}
                  {selected.reference}
                </div>
                <div>
                  <span className="font-semibold">Captured amount:</span>{" "}
                  ₦{(selected.amount / 100).toLocaleString()}{" "}
                  {selected.currency}
                </div>
                <div>
                  <span className="font-semibold">First seen:</span>{" "}
                  {new Date(selected.firstSeenAt).toLocaleString()}
                </div>
                <div>
                  <span className="font-semibold">Note:</span>{" "}
                  {selected.resolutionNote || "—"}
                </div>
              </section>

              <Separator />

              {/* Live Paystack transaction */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    Live Paystack transaction
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => verify(selected.reference)}
                  >
                    Refresh
                  </Button>
                </div>

                {loadingTx && (
                  <div className="text-xs text-gray-500">Loading…</div>
                )}

                {!loadingTx && tx && (
                  <div className="rounded-md bg-gray-50 p-3 text-xs space-y-1 border">
                    <div>
                      <span className="font-semibold">Status:</span>{" "}
                      {tx.status}
                    </div>
                    <div>
                      <span className="font-semibold">Amount:</span>{" "}
                      ₦{(tx.amount / 100).toLocaleString()} {tx.currency}
                    </div>
                    <div>
                      <span className="font-semibold">Reference:</span>{" "}
                      {tx.reference}
                    </div>
                    <div>
                      <span className="font-semibold">Paid at:</span>{" "}
                      {tx.paid_at
                        ? new Date(tx.paid_at).toLocaleString()
                        : "N/A"}
                    </div>
                    <div>
                      <span className="font-semibold">Customer:</span>{" "}
                      {tx.customer?.email || "N/A"}
                    </div>
                  </div>
                )}

                {!loadingTx && !tx && (
                  <div className="text-xs text-gray-500">
                    No transaction details loaded yet. Use &quot;Refresh&quot;.
                  </div>
                )}
              </section>

              <p className="pt-1 text-[11px] text-gray-500">
                To create an order from this payment, go to{" "}
                <span className="font-semibold">Log Offline Sale</span> and
                reference this Paystack code in your internal notes.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
