"use client";

import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider basePath="/fleetlog/api/auth">{children}</SessionProvider>;
}
