"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Copy } from "lucide-react";
import toast from "react-hot-toast";

interface OrderSuccessModalProps {
  open: boolean;
  orderId: string;
  email: string;
  onClose?: () => void; // still used when user clicks continue shopping if needed
}

const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  open,
  orderId,
  email,
  onClose,
}) => {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  if (!open) return null;

  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy order ID");
    }
  };

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label="Order success"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6"
    >
      <div className="relative max-w-lg w-full bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-gray-200">
        <div className="p-10 flex flex-col items-center text-center gap-6">
          <div className="flex items-center justify-center mb-1">
            <div className="rounded-full bg-green-100 p-4 inline-flex">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Payment Successful
          </h1>
          <p className="text-base text-gray-600 max-w-[460px]">
            Thank you! Your order{" "}
            <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">
              {orderId || "—"}
            </span>{" "}
            has been placed.
          </p>
          <div className="text-sm text-gray-700">
            A receipt has been sent to <span className="font-medium">{email || "—"}</span>.
          </div>

          <div className="w-full flex flex-col sm:flex-row gap-3 mt-4">
            <button
              onClick={() => {
                // prefer using provided onClose to allow parent cleanup
                if (onClose) {
                  onClose();
                } else {
                  router.push("/all-products");
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#0f9d58] to-[#1ed760] text-white font-semibold rounded-full shadow-lg hover:brightness-105 transition"
            >
              Continue Shopping
            </button>
          </div>

          <div className="w-full flex flex-col items-center mt-6 gap-4">
            <div className="flex items-center gap-2 text-xs">
              <div className="font-semibold">Order ID:</div>
              <div className="relative flex items-center bg-gray-100 px-3 py-1 rounded font-mono text-sm">
                {orderId || "—"}
                <button
                  aria-label="Copy order ID"
                  onClick={handleCopyOrderId}
                  className="ml-2 flex items-center justify-center p-1 rounded hover:bg-gray-200 transition"
                >
                  <Copy className="w-4 h-4 text-gray-600" />
                </button>
                {copied && (
                  <div className="absolute -top-7 right-0 bg-black text-white text-[10px] px-2 py-1 rounded">
                    Copied!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-3 text-center text-[12px] text-gray-500">
          If you have any questions, reply to the email or contact support.
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessModal;
