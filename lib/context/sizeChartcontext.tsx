"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

interface SizeChartContextValue {
  isOpen: boolean;
  openSizeChart: () => void;
  closeSizeChart: () => void;
}

const SizeChartContext = createContext<SizeChartContextValue | undefined>(
  undefined
);

export function useSizeChart() {
  const ctx = useContext(SizeChartContext);
  if (!ctx) {
    throw new Error("useSizeChart must be used within a SizeChartProvider");
  }
  return ctx;
}

interface SizeChartProviderProps {
  children: ReactNode;
}

export const SizeChartProvider: React.FC<SizeChartProviderProps> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const openSizeChart = () => setIsOpen(true);
  const closeSizeChart = () => setIsOpen(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  return (
    <SizeChartContext.Provider
      value={{ isOpen, openSizeChart, closeSizeChart }}
    >
      {children}
    </SizeChartContext.Provider>
  );
};
