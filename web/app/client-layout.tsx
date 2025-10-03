'use client';

import React, { useState, useEffect } from "react";
import InlineLoader from "./components/inline-loader";
import { usePathname } from 'next/navigation';
import { AppProvider } from "./context/AppContext";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsLoading(true);

    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [pathname]);

  return (
    <AppProvider>
      {isLoading && (
        <div className="loader-overlay">
          <InlineLoader height="h-20" width="w-20" />
        </div>
      )}
      {children}
    </AppProvider>
  );
}