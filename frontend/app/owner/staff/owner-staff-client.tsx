"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createStaffCatalog,
  fetchServicesCatalog,
  fetchStaffCatalog,
  formatApiError,
  updateStaffCatalog,
  type CatalogServiceRow,
  type CatalogStaffRow,
} from "@/lib/salon-api";

function Body({ token }: { token: string }) {
  const [staff, setStaff] = useState<CatalogStaffRow[] | null>(null);
  const [services, setServices] = useState<CatalogServiceRow[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [name, setName] = useState("");
  const [selectedSvc, setSelectedSvc] = useState<number[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    const [s, sv] = await Promise.all([fetchStaffCatalog(token), fetchServicesCatalog(token)]);
    setBusy(false);
    if (!s.ok) {
      toast.error(formatApiError(s.body));
      setStaff([]);
    } else setStaff(s.data);
    if (!sv.ok) {
      setServices([]);
    } else setServices(sv.data);
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load staff
    void load();
  }, [load]);

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    const res = await createStaffCatalog(token, {
      name,
      service_ids: selectedSvc.length ? selectedSvc : undefined,
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Staff member added.");
    setName("");
    setSelectedSvc([]);
    void load();
  }

  async function toggleActive(row: CatalogStaffRow) {
    const res = await updateStaffCatalog(token, row.id, { is_active: !row.is_active });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success(row.is_active ? "Deactivated." : "Activated.");
    void load();
  }

  if (busy || staff === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Staff</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Stylists for your primary shop. Link barber accounts from the backend when needed.
        </p>
      </div>

      <form onSubmit={addStaff} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Add staff</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
          className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        {services && services.length > 0 ? (
          <fieldset className="mt-3">
            <legend className="text-xs font-medium text-zinc-500">Services</legend>
            <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSvc.includes(s.id)}
                    onChange={(e) => {
                      setSelectedSvc((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                      );
                    }}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <button
          type="submit"
          className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          Save
        </button>
      </form>

      {staff.length === 0 ? (
        <EmptyState icon={Users} title="No staff yet" description="Add your first stylist to take bookings." />
      ) : (
        <ul className="space-y-3">
          {staff.map((row) => (
            <li
              key={row.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">{row.name}</p>
                <p className="text-xs text-zinc-500">
                  {row.is_active ? "Active" : "Inactive"} · {row.services.map((s) => s.name).join(", ") || "No services"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggleActive(row)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-600"
              >
                {row.is_active ? "Deactivate" : "Activate"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OwnerStaffClient() {
  return (
    <SalonManagementGate>{(token) => <Body token={token} />}</SalonManagementGate>
  );
}
