"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createStaffCatalog,
  createStaffWithAccount,
  deleteStaffCatalog,
  fetchServicesCatalog,
  fetchStaffCatalog,
  formatApiError,
  updateStaffCatalog,
  type CatalogServiceRow,
  type CatalogStaffRow,
} from "@/lib/salon-api";

type StaffRoleOption = { value: string; label: string };
const STAFF_ROLE_OPTIONS: StaffRoleOption[] = [
  { value: "manager", label: "Manager" },
  { value: "senior_stylist", label: "Senior stylist" },
  { value: "stylist", label: "Stylist" },
  { value: "junior", label: "Junior stylist" },
  { value: "assistant", label: "Assistant" },
  { value: "reception", label: "Reception" },
];

type StaffFormState = {
  name: string;
  position_title: string;
  staff_role: string;
  work_mobile: string;
  address: string;
  age: string;
  experience_years: string;
  specialties_csv: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  bio: string;
  is_active: boolean;
  selectedSvc: number[];
  create_login: boolean;
  login_mobile: string;
  password: string;
  password_confirmation: string;
};

function toForm(row?: CatalogStaffRow): StaffFormState {
  if (!row) {
    return {
      name: "",
      position_title: "",
      staff_role: "stylist",
      work_mobile: "",
      address: "",
      age: "",
      experience_years: "",
      specialties_csv: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      bio: "",
      is_active: true,
      selectedSvc: [],
      create_login: false,
      login_mobile: "",
      password: "",
      password_confirmation: "",
    };
  }
  return {
    name: row.name ?? "",
    position_title: row.position_title ?? "",
    staff_role: row.staff_role ?? "stylist",
    work_mobile: row.work_mobile ?? "",
    address: row.address ?? "",
    age: row.age == null ? "" : String(row.age),
    experience_years: row.experience_years == null ? "" : String(row.experience_years),
    specialties_csv: (row.specialties ?? []).join(", "),
    emergency_contact_name: row.emergency_contact_name ?? "",
    emergency_contact_phone: row.emergency_contact_phone ?? "",
    bio: row.bio ?? "",
    is_active: row.is_active,
    selectedSvc: row.services.map((s) => s.id),
    create_login: false,
    login_mobile: row.login_mobile ?? "",
    password: "",
    password_confirmation: "",
  };
}

function parseSpecialties(raw: string): string[] {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x !== "");
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

function Body({ token }: { token: string }) {
  const [staff, setStaff] = useState<CatalogStaffRow[] | null>(null);
  const [services, setServices] = useState<CatalogServiceRow[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState<StaffFormState>(() => toForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<StaffFormState>(() => toForm());

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
    setSaving(true);
    const basePayload = {
      name: adding.name,
      position_title: adding.position_title || null,
      staff_role: adding.staff_role || null,
      work_mobile: adding.work_mobile || null,
      address: adding.address || null,
      age: parseOptionalInt(adding.age),
      experience_years: parseOptionalInt(adding.experience_years),
      specialties: parseSpecialties(adding.specialties_csv),
      emergency_contact_name: adding.emergency_contact_name || null,
      emergency_contact_phone: adding.emergency_contact_phone || null,
      bio: adding.bio || null,
      is_active: adding.is_active,
      service_ids: adding.selectedSvc.length ? adding.selectedSvc : undefined,
    };
    const res = adding.create_login
      ? await createStaffWithAccount(token, {
          ...basePayload,
          mobile: adding.login_mobile,
          password: adding.password,
          password_confirmation: adding.password_confirmation,
        })
      : await createStaffCatalog(token, basePayload);
    setSaving(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Staff member added.");
    setAdding(toForm());
    void load();
  }

  function startEdit(row: CatalogStaffRow) {
    setEditingId(row.id);
    setEditForm(toForm(row));
  }

  function stopEdit() {
    setEditingId(null);
    setEditForm(toForm());
  }

  async function saveEdit(row: CatalogStaffRow) {
    setSaving(true);
    const payload: Parameters<typeof updateStaffCatalog>[2] = {
      name: editForm.name,
      position_title: editForm.position_title || null,
      staff_role: editForm.staff_role || null,
      work_mobile: editForm.work_mobile || null,
      address: editForm.address || null,
      age: parseOptionalInt(editForm.age),
      experience_years: parseOptionalInt(editForm.experience_years),
      specialties: parseSpecialties(editForm.specialties_csv),
      emergency_contact_name: editForm.emergency_contact_name || null,
      emergency_contact_phone: editForm.emergency_contact_phone || null,
      bio: editForm.bio || null,
      is_active: editForm.is_active,
      service_ids: editForm.selectedSvc,
    };
    if (editForm.login_mobile.trim() !== "") payload.mobile = editForm.login_mobile;
    if (editForm.password.trim() !== "") {
      payload.password = editForm.password;
      payload.password_confirmation = editForm.password_confirmation;
    }
    const res = await updateStaffCatalog(token, row.id, payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Staff updated.");
    stopEdit();
    void load();
  }

  async function removeRow(row: CatalogStaffRow) {
    const ok = confirm(`Remove ${row.name}?`);
    if (!ok) return;
    setSaving(true);
    const res = await deleteStaffCatalog(token, row.id);
    setSaving(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success(res.message || "Staff removed.");
    if (editingId === row.id) stopEdit();
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
          Real-life team records and staff login credentials. Staff can edit only their own profile; managers can update
          or remove any staff member here.
        </p>
      </div>

      <form onSubmit={addStaff} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Add staff</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={adding.name}
            onChange={(e) => setAdding((p) => ({ ...p, name: e.target.value }))}
            placeholder="Full name"
            required
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={adding.position_title}
            onChange={(e) => setAdding((p) => ({ ...p, position_title: e.target.value }))}
            placeholder="Position title (e.g. Senior stylist)"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <select
            value={adding.staff_role}
            onChange={(e) => setAdding((p) => ({ ...p, staff_role: e.target.value }))}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {STAFF_ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            value={adding.work_mobile}
            onChange={(e) => setAdding((p) => ({ ...p, work_mobile: e.target.value }))}
            placeholder="Work mobile"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={adding.age}
            onChange={(e) => setAdding((p) => ({ ...p, age: e.target.value }))}
            placeholder="Age"
            inputMode="numeric"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={adding.experience_years}
            onChange={(e) => setAdding((p) => ({ ...p, experience_years: e.target.value }))}
            placeholder="Experience years"
            inputMode="numeric"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={adding.emergency_contact_name}
            onChange={(e) => setAdding((p) => ({ ...p, emergency_contact_name: e.target.value }))}
            placeholder="Emergency contact name"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={adding.emergency_contact_phone}
            onChange={(e) => setAdding((p) => ({ ...p, emergency_contact_phone: e.target.value }))}
            placeholder="Emergency contact phone"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <textarea
          value={adding.address}
          onChange={(e) => setAdding((p) => ({ ...p, address: e.target.value }))}
          placeholder="Address"
          rows={2}
          className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          value={adding.specialties_csv}
          onChange={(e) => setAdding((p) => ({ ...p, specialties_csv: e.target.value }))}
          placeholder="Specialties (comma separated)"
          className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <textarea
          value={adding.bio}
          onChange={(e) => setAdding((p) => ({ ...p, bio: e.target.value }))}
          placeholder="Short bio"
          rows={3}
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
                    checked={adding.selectedSvc.includes(s.id)}
                    onChange={(e) => {
                      setAdding((prev) => ({
                        ...prev,
                        selectedSvc: e.target.checked
                          ? [...prev.selectedSvc, s.id]
                          : prev.selectedSvc.filter((x) => x !== s.id),
                      }));
                    }}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={adding.create_login}
            onChange={(e) => setAdding((p) => ({ ...p, create_login: e.target.checked }))}
          />
          Create staff login credentials now
        </label>
        {adding.create_login ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              value={adding.login_mobile}
              onChange={(e) => setAdding((p) => ({ ...p, login_mobile: e.target.value }))}
              placeholder="Login mobile"
              required
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              type="password"
              value={adding.password}
              onChange={(e) => setAdding((p) => ({ ...p, password: e.target.value }))}
              placeholder="Password"
              required
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              type="password"
              value={adding.password_confirmation}
              onChange={(e) => setAdding((p) => ({ ...p, password_confirmation: e.target.value }))}
              placeholder="Confirm password"
              required
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </form>

      {staff.length === 0 ? (
        <EmptyState icon={Users} title="No staff yet" description="Add your first stylist to take bookings." />
      ) : (
        <ul className="space-y-3">
          {staff.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">{row.name}</p>
                  <p className="text-xs text-zinc-500">
                    {row.position_title || row.staff_role || "No role set"} · {row.is_active ? "Active" : "Inactive"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Services: {row.services.map((s) => s.name).join(", ") || "No services"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Login: {row.has_staff_login ? row.login_mobile || "Linked account" : "No login account"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {editingId === row.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void saveEdit(row)}
                        disabled={saving}
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-rose-100 dark:text-zinc-900"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={stopEdit}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-600"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-600"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeRow(row)}
                    disabled={saving}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {editingId === row.id ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Full name"
                  />
                  <input
                    value={editForm.position_title}
                    onChange={(e) => setEditForm((p) => ({ ...p, position_title: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Position title"
                  />
                  <select
                    value={editForm.staff_role}
                    onChange={(e) => setEditForm((p) => ({ ...p, staff_role: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    {STAFF_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                    />
                    Active
                  </label>
                  <input
                    value={editForm.work_mobile}
                    onChange={(e) => setEditForm((p) => ({ ...p, work_mobile: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Work mobile"
                  />
                  <input
                    value={editForm.login_mobile}
                    onChange={(e) => setEditForm((p) => ({ ...p, login_mobile: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Login mobile (optional update)"
                  />
                  <input
                    value={editForm.age}
                    onChange={(e) => setEditForm((p) => ({ ...p, age: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Age"
                    inputMode="numeric"
                  />
                  <input
                    value={editForm.experience_years}
                    onChange={(e) => setEditForm((p) => ({ ...p, experience_years: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Experience years"
                    inputMode="numeric"
                  />
                  <input
                    value={editForm.emergency_contact_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, emergency_contact_name: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Emergency contact name"
                  />
                  <input
                    value={editForm.emergency_contact_phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, emergency_contact_phone: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Emergency contact phone"
                  />
                  <textarea
                    value={editForm.address}
                    onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                    rows={2}
                    className="md:col-span-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Address"
                  />
                  <input
                    value={editForm.specialties_csv}
                    onChange={(e) => setEditForm((p) => ({ ...p, specialties_csv: e.target.value }))}
                    className="md:col-span-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Specialties (comma separated)"
                  />
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                    rows={3}
                    className="md:col-span-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Bio"
                  />
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="New password (optional)"
                  />
                  <input
                    type="password"
                    value={editForm.password_confirmation}
                    onChange={(e) => setEditForm((p) => ({ ...p, password_confirmation: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Confirm new password"
                  />
                  {services && services.length > 0 ? (
                    <fieldset className="md:col-span-2">
                      <legend className="text-xs font-medium text-zinc-500">Services</legend>
                      <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                        {services.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editForm.selectedSvc.includes(s.id)}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  selectedSvc: e.target.checked
                                    ? [...prev.selectedSvc, s.id]
                                    : prev.selectedSvc.filter((x) => x !== s.id),
                                }))
                              }
                            />
                            {s.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                </div>
              ) : null}
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
