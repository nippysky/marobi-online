// app/api/paystack/orphan-sweep/route.ts
export const runtime = "nodejs";           // run in Node.js runtime
export const dynamic = "force-dynamic";    // never cache this endpoint

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import { verifyTransaction, refundTransaction } from "@/lib/paystack";

const RECONCILE_SECRET = process.env.RECONCILE_SECRET || "";
const AUTO_REFUND_ORPHANS = process.env.AUTO_REFUND_ORPHANS === "true";

/**
 * Guard: requires shared secret header. If secret is not configured, endpoint is disabled.
 */
function requireAuth(req: NextRequest): boolean {
  const header = req.headers.get("x-reconcile-secret") || "";
  return Boolean(RECONCILE_SECRET) && header === RECONCILE_SECRET;
}

export async function POST(req: NextRequest) {
  try {
    await prismaReady;

    if (!RECONCILE_SECRET) {
      console.error("Orphan sweep: reconcile secret not configured.");
      return NextResponse.json(
        { error: "Reconcile secret not configured" },
        { status: 500 }
      );
    }

    if (!requireAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    // Only sweep orphans older than X minutes to avoid racing with in-flight orders
    const minAgeMinutes = 10;
    const cutoff = new Date(now.getTime() - minAgeMinutes * 60 * 1000);

    // Get all unresolved orphans (older than cutoff)
    const orphans = await prisma.orphanPayment.findMany({
      where: {
        reconciled: false,
        firstSeenAt: { lt: cutoff },
      },
    });

    // Summary stats for reporting/audit
    const summary: {
      checked: number;
      alreadyResolved: number;
      autoRefunded: number;
      flagged: number;
      skippedAlreadyAutoRefunded: number;
      amountMismatches: number;
      errors: string[];
    } = {
      checked: orphans.length,
      alreadyResolved: 0,
      autoRefunded: 0,
      flagged: 0,
      skippedAlreadyAutoRefunded: 0,
      amountMismatches: 0,
      errors: [],
    };

    for (const orphan of orphans) {
      try {
        // 1) Skip if already auto-refunded previously
        if (orphan.resolutionNote?.includes("Auto-refunded")) {
          summary.skippedAlreadyAutoRefunded += 1;
          continue;
        }

        // 2) Verify Paystack transaction
        let tx: any;
        try {
          tx = await verifyTransaction(orphan.reference);
        } catch (verificationErr: any) {
          summary.errors.push(
            `Verification failed for ${orphan.reference}: ${verificationErr?.message || verificationErr}`
          );
          continue;
        }

        // 3) Check if an order has appeared (race condition)
        const existingOrder = await prisma.order.findUnique({
          where: { paymentReference: orphan.reference },
        });
        if (existingOrder) {
          await prisma.orphanPayment.update({
            where: { reference: orphan.reference },
            data: {
              reconciled: true,
              reconciledAt: new Date(),
              resolutionNote: "Order appeared during sweep; reconciled",
              payload: tx as any,
            },
          });
          summary.alreadyResolved += 1;
          continue;
        }

        // 4) Amount mismatch (values are lowest denomination)
        if (orphan.amount !== tx.amount) {
          summary.amountMismatches += 1;
          await prisma.orphanPayment.update({
            where: { reference: orphan.reference },
            data: {
              resolutionNote: `Amount mismatch: orphan recorded ${orphan.amount}, actual ${tx.amount}; flagged for review`,
              payload: tx as any,
            },
          });
          continue;
        }

        // 5) Either auto-refund or flag for manual reconciliation
        if (AUTO_REFUND_ORPHANS) {
          try {
            const refund = await refundTransaction({
              transaction: tx.id,
              reason: "Auto-refund orphan payment during sweep (no matching order)",
            });

            const resolutionNote = `Auto-refunded orphan payment during sweep; refund id=${refund?.id ?? "unknown"}`;
            await prisma.orphanPayment.update({
              where: { reference: orphan.reference },
              data: {
                reconciled: true,
                reconciledAt: new Date(),
                resolutionNote,
                payload: tx as any,
              },
            });
            summary.autoRefunded += 1;
          } catch (refundErr: any) {
            summary.errors.push(
              `Refund failed for ${orphan.reference}: ${refundErr?.message || refundErr}`
            );
          }
        } else {
          await prisma.orphanPayment.update({
            where: { reference: orphan.reference },
            data: {
              resolutionNote:
                "Verified payment, no order exists; flagged for manual reconciliation",
              payload: tx as any,
            },
          });
          summary.flagged += 1;
        }
      } catch (e: any) {
        summary.errors.push(
          `Unhandled error for ${orphan.reference}: ${e?.message || String(e)}`
        );
      }
    }

    return NextResponse.json({ summary }, { status: 200 });
  } catch (err: any) {
    console.error("Orphan sweep fatal error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
