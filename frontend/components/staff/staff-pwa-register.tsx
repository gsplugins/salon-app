"use client";

import { useEffect } from "react";

export function StaffPwaRegister() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const href = "/staff-manifest.json";
    if (!document.querySelector(`link[rel="manifest"][href="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = href;
      document.head.appendChild(link);
    }
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw-staff.js").catch(() => {});
    }
  }, []);
  return null;
}
