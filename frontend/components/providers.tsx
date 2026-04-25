"use client";

import { Toaster } from "sonner";
import { NavigationLoading } from "@/components/navigation-loading";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NavigationLoading />
      {children}
      <Toaster richColors position="top-center" closeButton />
    </ThemeProvider>
  );
}
