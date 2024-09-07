"use client";

import React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "./utils/auth";
import "./global.css";
import { AppProvider } from "./context/AppContext";
import Head from "next/head";

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
      <Head>
        <link rel="icon" href="favicon.ico" />
        <title>Cleverum - Restaurant</title>
      </Head>
      <AppProvider>
        <body>{children}</body>
      </AppProvider>
    </html>
  );
}
