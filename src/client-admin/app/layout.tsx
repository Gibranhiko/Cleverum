"use client";

import React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "./lib/auth";
import "./global.css";

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
      <body>{children}</body>
    </html>
  );
}
