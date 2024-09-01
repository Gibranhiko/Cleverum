"use client";

import React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "./utils/auth";
import "./global.css";
import { AppProvider } from "./context/AppContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
    }
  }, [router]);

  return (
    <html lang="en">
      <AppProvider>
        <body>{children}</body>
      </AppProvider>
    </html>
  );
}
