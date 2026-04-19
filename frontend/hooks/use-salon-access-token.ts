"use client";

import { useEffect, useState } from "react";
import { SALON_AUTH_CHANGE_EVENT } from "@/lib/auth-events";

const LS_ACCESS = "salon_access_token";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_ACCESS);
}

export function useSalonAccessToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read token after mount (no SSR localStorage)
    setToken(readToken());

    const onAuthChange = (): void => setToken(readToken());
    window.addEventListener(SALON_AUTH_CHANGE_EVENT, onAuthChange);
    window.addEventListener("storage", onAuthChange);

    return () => {
      window.removeEventListener(SALON_AUTH_CHANGE_EVENT, onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);
  return token;
}
