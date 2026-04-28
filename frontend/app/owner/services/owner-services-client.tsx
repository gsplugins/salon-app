"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Scissors } from "lucide-react";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createServiceCatalog,
  fetchOwnerInventory,
  fetchServiceInventoryLinks,
  fetchServicesCatalog,
  formatApiError,
  putServiceInventoryLinks,
  updateServiceCatalog,
  type CatalogServiceRow,
  type InventoryRow,
} from "@/lib/salon-api";

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(
    cents / 100
  );
}

const AUDIENCE: { value: CatalogServiceRow["audience"]; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "kids", label: "Kids" },
];

function audienceLabel(v: CatalogServiceRow["audience"] | undefined): string {
  return AUDIENCE.find((a) => a.value === v)?.label ?? "Everyone";
}

function parsePriceToCents(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseDepositToCents(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

type MaterialDraft = {
  inventory_item_id: number;
  quantity_per_service: string;
  staff_note: string;
  material_cost: string;
};

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<CatalogServiceRow[] | null>(null);
  const [inventoryList, setInventoryList] = useState<InventoryRow[]>([]);
  const [materialLines, setMaterialLines] = useState<MaterialDraft[]>([]);
  const [busy, setBusy] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [toggleBusyId, setToggleBusyId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [price, setPrice] = useState("");
  const [audience, setAudience] = useState<CatalogServiceRow["audience"]>("all");
  const [staffNotes, setStaffNotes] = useState("");
  const [aftercare, setAftercare] = useState("");
  const [requiresPatchTest, setRequiresPatchTest] = useState(false);
  const [consultationFirst, setConsultationFirst] = useState(false);
  const [minNoticeHours, setMinNoticeHours] = useState(0);
  const [onlineBookable, setOnlineBookable] = useState(true);
  const [deposit, setDeposit] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchServicesCatalog(token);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetchOwnerInventory(token).then((res) => {
      if (res.ok) setInventoryList(res.data);
    });
  }, [token]);

  useEffect(() => {
    if (editingId == null) {
      setMaterialLines([]);
      return;
    }
    let cancelled = false;
    void fetchServiceInventoryLinks(token, editingId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        toast.error(formatApiError(res.body));
        setMaterialLines([]);
        return;
      }
      setMaterialLines(
        res.data.map((row) => ({
          inventory_item_id: row.inventory_item_id,
          quantity_per_service: String(row.quantity_per_service ?? "1"),
          staff_note: row.staff_note ?? "",
          material_cost:
            row.material_cost_cents != null && row.material_cost_cents > 0
              ? String(row.material_cost_cents / 100)
              : "",
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [editingId, token]);

  function resetAddForm() {
    setName("");
    setCategory("");
    setDescription("");
    setDuration(30);
    setBufferAfter(0);
    setPrice("");
    setAudience("all");
    setStaffNotes("");
    setAftercare("");
    setRequiresPatchTest(false);
    setConsultationFirst(false);
    setMinNoticeHours(0);
    setOnlineBookable(true);
    setDeposit("");
  }

  function fillFormFromRow(r: CatalogServiceRow) {
    setName(r.name);
    setCategory(r.category ?? "");
    setDescription(r.description ?? "");
    setDuration(r.duration_minutes);
    setBufferAfter(r.buffer_after_minutes ?? 0);
    setPrice(r.price_cents != null ? String(r.price_cents / 100) : "");
    setAudience(r.audience ?? "all");
    setStaffNotes(r.staff_notes ?? "");
    setAftercare(r.aftercare ?? "");
    setRequiresPatchTest(Boolean(r.requires_patch_test));
    setConsultationFirst(Boolean(r.consultation_first));
    setMinNoticeHours(r.min_notice_hours ?? 0);
    setOnlineBookable(r.online_bookable !== false);
    setDeposit(r.deposit_cents != null ? String(r.deposit_cents / 100) : "");
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSubmitBusy(true);
    const priceCents = parsePriceToCents(price);
    const depositCents = parseDepositToCents(deposit);
    const res = await createServiceCatalog(token, {
      name,
      category: category.trim() === "" ? null : category.trim(),
      description: description.trim() === "" ? null : description.trim(),
      duration_minutes: duration,
      buffer_after_minutes: bufferAfter,
      price_cents: priceCents,
      audience,
      staff_notes: staffNotes.trim() === "" ? null : staffNotes.trim(),
      aftercare: aftercare.trim() === "" ? null : aftercare.trim(),
      requires_patch_test: requiresPatchTest,
      consultation_first: consultationFirst,
      min_notice_hours: minNoticeHours,
      online_bookable: onlineBookable,
      deposit_cents: depositCents,
    });
    if (!res.ok) {
      setSubmitBusy(false);
      toast.error(formatApiError(res.body));
      return;
    }
    setSubmitBusy(false);
    toast.success("Service created.");
    resetAddForm();
    void load();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId == null) return;
    setSubmitBusy(true);
    const priceCents = parsePriceToCents(price);
    const depositCents = parseDepositToCents(deposit);
    const res = await updateServiceCatalog(token, editingId, {
      name,
      category: category.trim() === "" ? null : category.trim(),
      description: description.trim() === "" ? null : description.trim(),
      duration_minutes: duration,
      buffer_after_minutes: bufferAfter,
      price_cents: priceCents,
      audience,
      staff_notes: staffNotes.trim() === "" ? null : staffNotes.trim(),
      aftercare: aftercare.trim() === "" ? null : aftercare.trim(),
      requires_patch_test: requiresPatchTest,
      consultation_first: consultationFirst,
      min_notice_hours: minNoticeHours,
      online_bookable: onlineBookable,
      deposit_cents: depositCents,
    });
    if (!res.ok) {
      setSubmitBusy(false);
      toast.error(formatApiError(res.body));
      return;
    }
    const matItems = [];
    const used = new Set<number>();
    for (const line of materialLines) {
      if (!line.inventory_item_id) continue;
      if (used.has(line.inventory_item_id)) {
        toast.error("Each product can only appear once in materials.");
        setSubmitBusy(false);
        return;
      }
      used.add(line.inventory_item_id);
      const qps = Number.parseFloat(line.quantity_per_service);
      if (!Number.isFinite(qps) || qps <= 0) {
        toast.error("Quantity per service must be a positive number.");
        setSubmitBusy(false);
        return;
      }
      const mc = line.material_cost.trim();
      let material_cost_cents: number | null = null;
      if (mc !== "") {
        const n = Number.parseFloat(mc);
        if (!Number.isFinite(n) || n < 0) {
          toast.error("Invalid material cost.");
          setSubmitBusy(false);
          return;
        }
        material_cost_cents = Math.round(n * 100);
      }
      matItems.push({
        inventory_item_id: line.inventory_item_id,
        quantity_per_service: qps,
        staff_note: line.staff_note.trim() === "" ? null : line.staff_note.trim(),
        material_cost_cents,
      });
    }
    const putMat = await putServiceInventoryLinks(token, editingId, { items: matItems });
    if (!putMat.ok) {
      setSubmitBusy(false);
      toast.error(formatApiError(putMat.body));
      return;
    }
    setSubmitBusy(false);
    toast.success("Service updated.");
    setEditingId(null);
    resetAddForm();
    void load();
  }

  async function toggle(row: CatalogServiceRow) {
    setToggleBusyId(row.id);
    const res = await updateServiceCatalog(token, row.id, { is_active: !row.is_active });
    setToggleBusyId(null);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Updated.");
    void load();
  }

  function addMaterialLine() {
    setMaterialLines((prev) => {
      const used = new Set(prev.map((m) => m.inventory_item_id));
      const pick = inventoryList.find((i) => !used.has(i.id));
      const id = pick?.id ?? inventoryList[0]?.id ?? 0;
      if (!id) {
        toast.error("Add inventory products first, then link them here.");
        return prev;
      }
      if (pick == null && inventoryList.length > 0 && used.size >= inventoryList.length) {
        toast.error("Each product is already linked — remove a line or add a new inventory item.");
        return prev;
      }
      return [...prev, { inventory_item_id: id, quantity_per_service: "1", staff_note: "", material_cost: "" }];
    });
  }

  function removeMaterialLine(index: number) {
    setMaterialLines((prev) => prev.filter((_, i) => i !== index));
  }

  function startEdit(r: CatalogServiceRow) {
    setEditingId(r.id);
    fillFormFromRow(r);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    resetAddForm();
  }

  if (busy || rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 [&_a]:cursor-pointer [&_button]:cursor-pointer [&_label]:cursor-pointer [&_select]:cursor-pointer [&_input[type='checkbox']]:cursor-pointer [&_input[type='radio']]:cursor-pointer">
      <div>
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-white">Services &amp; pricing</h1>
        <p className="text-sm text-zinc-800 dark:text-zinc-400">
          Add what clients see online, turnaround time, who the service fits, safety (patch test), deposits, and notes
          your team uses behind the desk.
        </p>
      </div>

      <form
        onSubmit={editingId != null ? saveEdit : add}
        className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-white">
            {editingId != null ? `Edit service #${editingId}` : "Add service"}
          </h2>
          {editingId != null ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm font-medium text-zinc-800 underline dark:text-zinc-400"
              disabled={submitBusy}
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400">
            Name *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400">
            Category
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Hair · Color · Spa"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400 sm:col-span-2">
            Client-facing description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What the client gets, what to expect, what hair length or skin type it suits…"
              className="mt-1 w-full resize-y rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400">
            Duration (minutes) *
            <input
              type="number"
              min={5}
              max={480}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400">
            Cleanup / buffer after (minutes)
            <input
              type="number"
              min={0}
              max={120}
              value={bufferAfter}
              onChange={(e) => setBufferAfter(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400">
            Price (leave empty if quote-only)
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 1200"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400">
            Who it&apos;s for
            <select
              value={audience ?? "all"}
              onChange={(e) => setAudience(e.target.value as CatalogServiceRow["audience"])}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {AUDIENCE.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400 sm:col-span-2">
            Staff notes (not shown to clients online)
            <textarea
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              rows={2}
              placeholder="Mix ratios, default developer volume, upsell path, contraindications for your team…"
              className="mt-1 w-full resize-y rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400 sm:col-span-2">
            Aftercare (shown with booking / on detail pages)
            <textarea
              value={aftercare}
              onChange={(e) => setAftercare(e.target.value)}
              rows={2}
              placeholder="Wait 48h before washing, avoid heat, use sulfate-free…"
              className="mt-1 w-full resize-y rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400">
            Min. advance booking (hours)
            <input
              type="number"
              min={0}
              max={720}
              value={minNoticeHours}
              onChange={(e) => setMinNoticeHours(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400">
            Deposit (optional, same currency as price)
            <input
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="e.g. 500"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </div>

        {editingId != null ? (
          <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-white">Products per appointment</h3>
            <p className="mt-1 text-xs text-zinc-800">
              Link inventory items to this service (how much stock one visit uses). Optional fixed material cost per
              visit is visible only to staff in the staff app — not on the public booking page.
            </p>
            {inventoryList.length === 0 ? (
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                No inventory products yet. Add some under Inventory, then return here.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {materialLines.map((line, idx) => (
                  <div
                    key={`${line.inventory_item_id}-${idx}`}
                    className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end dark:border-zinc-700 dark:bg-zinc-950/50"
                  >
                    <label className="min-w-[160px] flex-1 text-xs font-medium text-zinc-800 dark:text-zinc-400">
                      Product
                      <select
                        value={line.inventory_item_id}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMaterialLines((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, inventory_item_id: v } : p))
                          );
                        }}
                        className="mt-1 w-full cursor-pointer rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        {inventoryList.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} ({inv.quantity} {inv.unit})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="w-28 text-xs font-medium text-zinc-800 dark:text-zinc-400">
                      Qty / visit
                      <input
                        value={line.quantity_per_service}
                        onChange={(e) =>
                          setMaterialLines((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, quantity_per_service: e.target.value } : p))
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        inputMode="decimal"
                      />
                    </label>
                    <label className="min-w-[120px] flex-1 text-xs font-medium text-zinc-800 dark:text-zinc-400">
                      Material cost / visit (optional)
                      <input
                        value={line.material_cost}
                        onChange={(e) =>
                          setMaterialLines((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, material_cost: e.target.value } : p))
                          )
                        }
                        placeholder="e.g. 50"
                        className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        inputMode="decimal"
                      />
                    </label>
                    <label className="min-w-[140px] flex-[2] text-xs font-medium text-zinc-800 dark:text-zinc-400">
                      Staff note (internal)
                      <input
                        value={line.staff_note}
                        onChange={(e) =>
                          setMaterialLines((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, staff_note: e.target.value } : p))
                          )
                        }
                        placeholder="e.g. one pump only"
                        className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeMaterialLine(idx)}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-600"
                      disabled={submitBusy}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addMaterialLine}
                  className="text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
                  disabled={submitBusy}
                >
                  + Add product line
                </button>
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={requiresPatchTest} onChange={(e) => setRequiresPatchTest(e.target.checked)} className="cursor-pointer" />
            <span className="text-zinc-800 dark:text-zinc-200">Patch / allergy test required (e.g. color)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={consultationFirst}
              onChange={(e) => setConsultationFirst(e.target.checked)}
              className="cursor-pointer"
            />
            <span className="text-zinc-800 dark:text-zinc-200">Consultation recommended first</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={onlineBookable} onChange={(e) => setOnlineBookable(e.target.checked)} className="cursor-pointer" />
            <span className="text-zinc-800 dark:text-zinc-200">Bookable online</span>
          </label>
        </div>

        <button
          type="submit"
          className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-100 dark:text-zinc-800"
          disabled={submitBusy}
        >
          {submitBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {submitBusy ? "Saving..." : editingId != null ? "Save changes" : "Save new service"}
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={Scissors} title="No services" description="Create services customers can book online." />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-800 dark:text-white">{r.name}</p>
                  <p className="text-sm text-zinc-800">
                    {r.duration_minutes} min + {r.buffer_after_minutes ?? 0} min buffer · {formatMoney(r.price_cents)}
                    {r.category ? ` · ${r.category}` : ""} · {audienceLabel(r.audience)}
                    {!r.is_active ? " · inactive" : ""}
                    {r.online_bookable === false ? " · not online" : ""}
                  </p>
                  {r.description ? (
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-800 dark:text-zinc-400">{r.description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-800">
                    {r.requires_patch_test ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        Patch test
                      </span>
                    ) : null}
                    {r.consultation_first ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-900 dark:bg-blue-950 dark:text-blue-100">
                        Consult first
                      </span>
                    ) : null}
                    {(r.min_notice_hours ?? 0) > 0 ? (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
                        {r.min_notice_hours}h notice
                      </span>
                    ) : null}
                    {r.deposit_cents != null && r.deposit_cents > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                        Deposit {formatMoney(r.deposit_cents)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="cursor-pointer rounded-lg border border-zinc-200 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600"
                    disabled={submitBusy || toggleBusyId != null}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggle(r)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600"
                    disabled={submitBusy || toggleBusyId != null}
                  >
                    {toggleBusyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    {toggleBusyId === r.id ? "Updating..." : r.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OwnerServicesClient() {
  return <SalonManagementGate>{(token) => <Body token={token} />}</SalonManagementGate>;
}
