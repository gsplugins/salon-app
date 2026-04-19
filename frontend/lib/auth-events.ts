/** Dispatched when JWT is saved or cleared (login, logout, refresh). */
export const SALON_AUTH_CHANGE_EVENT = "salon-auth-changed";

export function broadcastSalonAuthChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SALON_AUTH_CHANGE_EVENT));
}
