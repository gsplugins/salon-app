/** Must match Laravel `SalonManagementContext::ACT_AS_STAFF_ID_HEADER`. */
export const SALON_ACT_AS_STAFF_ID_HEADER = "X-Act-As-Staff-Id";

const STORAGE_KEY = "salon_staff_act_as_id";

export function getStaffActAsStaffId(): string | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(STORAGE_KEY);
  if (v === null || v.trim() === "") return null;
  return v.trim();
}

export function setStaffActAsStaffId(id: number | null): void {
  if (typeof window === "undefined") return;
  if (id === null || Number.isNaN(id)) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, String(id));
}
