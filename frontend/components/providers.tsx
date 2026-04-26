"use client";

import { Suspense } from "react";
import { Toaster } from "sonner";
import { NavigationLoading } from "@/components/navigation-loading";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <NavigationLoading />
      </Suspense>
      {children}
      <Toaster richColors position="top-center" closeButton />
    </>
  );
}
