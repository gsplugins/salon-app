"use client";

import { Suspense } from "react";
import { Toaster } from "sonner";
import { NavigationLoading } from "@/components/navigation-loading";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Suspense fallback={null}>
        <NavigationLoading />
      </Suspense>
      {children}
      <Toaster richColors position="top-center" closeButton />
    </ThemeProvider>
  );
}
