"use client";

import React from "react";
import "./global.css";
import { AppProvider } from "./context/AppContext";
import Head from "next/head";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <html lang="en">
      <Head>
        <link rel="icon" href="/restaurant-bot/favicon.ico" />
        <title>Cleverum - Restaurant</title>
      </Head>
      <AppProvider>
        <body>{children}</body>
      </AppProvider>
    </html>
  );
}
