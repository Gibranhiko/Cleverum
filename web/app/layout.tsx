import React from "react";
import { Metadata } from 'next';
import "./global.css";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: 'Cleverum',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
