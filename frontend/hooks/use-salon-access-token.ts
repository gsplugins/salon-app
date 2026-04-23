"use client";

import { useEffect, useState } from "react";
import { SALON_AUTH_CHANGE_EVENT } from "@/lib/auth-events";

const LS_ACCESS = "salon_access_token";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_ACCESS);
}

/** Same as {@link useSalonAccessToken} plus `ready` after localStorage has been read (avoids flashing “signed out”). */
export function useSalonAccessTokenReady(): { token: string | null; ready: boolean } {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
     
    setToken(readToken());
    setReady(true);

    const onAuthChange = (): void => setToken(readToken());
    window.addEventListener(SALON_AUTH_CHANGE_EVENT, onAuthChange);
    window.addEventListener("storage", onAuthChange);

    return () => {
      window.removeEventListener(SALON_AUTH_CHANGE_EVENT, onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);
  return { token, ready };
}

export function useSalonAccessToken(): string | null {
  const { token } = useSalonAccessTokenReady();
  return token;
}
