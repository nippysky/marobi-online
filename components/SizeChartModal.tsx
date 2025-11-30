"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { useSizeChart } from "@/lib/context/sizeChartcontext";

interface Row {
  id: string;
  order: number;
  bodySize: string;
  productSize: string;
  code: string;
}

/* Animations: sheet for mobile, dialog for desktop */
const backdrop = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const sheet = { hidden: { y: "100%" }, visible: { y: 0 }, exit: { y: "100%" } };
const dialog = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

export const SizeChartModal: React.FC = () => {
  const { isOpen, closeSizeChart } = useSizeChart();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  /* Match md breakpoint to choose layout */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  /* Fetch when opened */
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setErr(null);
    fetch("/api/store-settings/size-chart", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("bad status");
        return r.json();
      })
      .then((data: { id: string; name: string; rows: Row[] }) => {
        const safe = Array.isArray(data?.rows) ? data.rows : [];
        setRows(safe.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      })
      .catch(() => setErr("Failed to load size chart"))
      .finally(() => setLoading(false));
  }, [isOpen]);

  /* Robust scroll lock */
  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prevH = html.style.overflow;
    const prevB = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevH;
      body.style.overflow = prevB;
    };
  }, [isOpen]);

  const hardUnlock = () => {
    requestAnimationFrame(() => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    });
  };
  const handleClose = useCallback(() => {
    closeSizeChart();
    hardUnlock();
  }, [closeSizeChart]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sc-backdrop"
            className="fixed inset-0 bg-black/50"
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="hidden"
            style={{zIndex: 10000000}}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
          />

          {/* Wrapper centers dialog on desktop, anchors sheet on mobile */}
          <div className="fixed inset-0 flex items-end md:items-center md:justify-center" style={{zIndex: 10000001}}>
            <motion.div
            style={{zIndex: 10000001}}
              key="sc-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Size Chart"
              /* Mobile sheet classes, overridden at md+ */
              className={[
                "w-full rounded-t-2xl bg-white shadow-xl",
                "max-h-[85vh] overflow-hidden", // overall container scroll boundary
                "md:w-full md:max-w-2xl md:rounded-2xl md:shadow-2xl md:max-h-[75vh]",
              ].join(" ")}
              variants={isDesktop ? dialog : sheet}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ type: "tween", duration: 0.24 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-gray-900 md:text-xl">Size Chart</h2>
                <button
                  onClick={handleClose}
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  aria-label="Close"
                >
                  <span className="hidden sm:inline">Close</span>
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content area uses its own scroll; height hugs content on desktop */}
              <div className="max-h-[calc(85vh-56px)] overflow-y-auto px-5 py-4 md:max-h-[calc(75vh-56px)]">
                {loading ? (
                  <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  </div>
                ) : err ? (
                  <p className="text-center text-sm font-medium text-red-600">{err}</p>
                ) : rows.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">No size chart available.</p>
                ) : (
                  <>
                    {/* Table on md+, stacked cards on mobile */}
                    <div className="space-y-3 sm:hidden">
                      {rows.map((r, i) => (
                        <div key={r.id} className="rounded-xl border border-gray-200 p-3 shadow-sm">
                          <div className="mb-1 text-xs text-gray-500">#{i + 1}</div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="col-span-3">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                Body Size
                              </div>
                              <div className="font-medium text-gray-900">{r.bodySize}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                Product Size
                              </div>
                              <div className="font-medium text-gray-900">{r.productSize}</div>
                            </div>
                            <div className="col-span-1">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                Code
                              </div>
                              <div className="font-semibold text-gray-900">{r.code}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden sm:block">
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-gray-50 text-gray-700">
                            <tr>
                              <th className="w-[70px] px-4 py-2">s/n</th>
                              <th className="px-4 py-2">Body Size</th>
                              <th className="px-4 py-2">Product Size</th>
                              <th className="w-[120px] px-4 py-2">Code</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {rows.map((r, i) => (
                              <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                                <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                                <td className="px-4 py-2 font-medium text-gray-900">{r.bodySize}</td>
                                <td className="px-4 py-2 text-gray-800">{r.productSize}</td>
                                <td className="px-4 py-2 font-semibold text-gray-900">{r.code}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-gray-500">
                      Use this as a guide. If you’re between sizes or unsure, choose the larger size or
                      contact us for help.
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
