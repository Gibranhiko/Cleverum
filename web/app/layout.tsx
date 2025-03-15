'use client';

import React, { useState, useEffect } from "react";
import "./global.css";
import Head from "next/head";
import InlineLoader from "./components/inline-loader";
import { usePathname } from 'next/navigation';
import { AppProvider } from "./context/AppContext";

export default function RootLayout({
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
    <html lang="en">
      <Head>
        <link rel="icon" href="/restaurant-bot/favicon.ico" />
        <title>Cleverum - Restaurant</title>
      </Head>
      <AppProvider>
      <body>
        {isLoading && (
          <div className="loader-overlay">
            <InlineLoader height="h-20" width="w-20" />
          </div>
        )}
        {children}
      </body>
      </AppProvider>
    </html>
  );
}
