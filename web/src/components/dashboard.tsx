"use client";

import { useMemo, useState, useTransition } from "react";
import type { InstagramMetrics } from "@/lib/socialblade";

type ColumnKey =
  | "displayName"
  | "handle"
  | "followers"
  | "averageViews"
  | "engagementRate"
  | "category"
  | "location"
  | "averageLikes";

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  isNumeric?: boolean;
};

type SortOrder = "asc" | "desc";

const columns: ColumnDefinition[] = [
  { key: "displayName", label: "Name" },
  { key: "handle", label: "Handle" },
  { key: "followers", label: "Followers", isNumeric: true },
  { key: "averageViews", label: "Avg. Views", isNumeric: true },
  { key: "engagementRate", label: "Eng. Rate", isNumeric: true },
  { key: "category", label: "Category" },
  { key: "location", label: "Location" },
  { key: "averageLikes", label: "Avg. Likes", isNumeric: true },
];

const compactNumber = Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const standardNumber = Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export default function Dashboard() {
  const [handlesInput, setHandlesInput] = useState("@instagram\n@cristiano");
  const [rows, setRows] = useState<InstagramMetrics[]>([]);
  const [errors, setErrors] = useState<Array<{ handle: string; message: string }>>([]);
  const [sortKey, setSortKey] = useState<ColumnKey>("followers");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isReloading, startReload] = useTransition();

  const parsedHandles = useMemo(
    () =>
      handlesInput
        .split(/[\s,]+/)
        .map((handle) => handle.trim())
        .filter((handle) => handle.length > 0),
    [handlesInput],
  );

  const sortedRows = useMemo(() => {
    const dataset = [...rows];

    dataset.sort((a, b) => {
      const aValue = extractSortValue(a, sortKey);
      const bValue = extractSortValue(b, sortKey);

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return sortOrder === "asc" ? 1 : -1;
      if (bValue === null) return sortOrder === "asc" ? -1 : 1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }

      return sortOrder === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    return dataset;
  }, [rows, sortKey, sortOrder]);

  const disabled = parsedHandles.length === 0 || isReloading;

  async function handleAnalyze() {
    startReload(async () => {
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handles: parsedHandles }),
        });

        if (!response.ok) {
          const errorPayload = await response.json();
          throw new Error(errorPayload.message ?? "Unable to fetch metrics.");
        }

        const payload = (await response.json()) as {
          data: InstagramMetrics[];
          errors: Array<{ handle: string; message: string }>;
        };

        setRows(payload.data);
        setErrors(payload.errors);
        setLastUpdatedAt(new Date());
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error occurred.";
        setErrors([{ handle: "request", message }]);
        setRows([]);
        setLastUpdatedAt(null);
      }
    });
  }

  function handleSort(column: ColumnDefinition) {
    if (sortKey === column.key) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(column.key);
    setSortOrder(column.isNumeric ? "desc" : "asc");
  }

  function formatCell(row: InstagramMetrics, column: ColumnDefinition) {
    const value = (row as Record<string, unknown>)[column.key];

    if (value === null || value === undefined) return "—";

    switch (column.key) {
      case "handle":
        return `@${value}`;
      case "followers":
      case "averageViews":
      case "averageLikes":
        return typeof value === "number" ? compactNumber.format(value) : "—";
      case "engagementRate":
        return typeof value === "number" ? `${value.toFixed(2)}%` : "—";
      default:
        return String(value);
    }
  }

  function formatSummary(row: InstagramMetrics) {
    return {
      Name: row.displayName,
      Handle: `@${row.handle}`,
      Followers: row.followers ?? "",
      "Avg. Views": row.averageViews ?? "",
      "Avg. Likes": row.averageLikes ?? "",
      "Engagement Rate (%)": row.engagementRate ?? "",
      Category: row.category,
      Location: row.location,
    };
  }

  function exportCsv() {
    if (!rows.length) return;

    const headers = columns.map((column) => column.label);
    const records = rows.map((row) =>
      columns
        .map((column) => {
          const value = formatCellForExport(row, column);
          const needsEscape = /[",\n]/.test(value);
          return needsEscape ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    );

    const csv = [headers.join(","), ...records].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `instagram-metrics-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportExcel() {
    if (!rows.length) return;

    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => formatSummary(row)));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Instagram Accounts");
    XLSX.writeFile(workbook, `instagram-metrics-${Date.now()}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-white/5 p-6 shadow-xl backdrop-blur md:p-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!parsedHandles.length) return;
          void handleAnalyze();
        }}
        className="flex flex-col gap-4"
      >
        <label htmlFor="handles" className="text-sm font-medium text-slate-200">
          Instagram Handles
        </label>
        <textarea
          id="handles"
          value={handlesInput}
          onChange={(event) => setHandlesInput(event.target.value)}
          placeholder="@yourbrand @creator123"
          className="min-h-[120px] rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-white outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/40"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-500 px-5 text-sm font-semibold text-white transition hover:bg-violet-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:bg-white/10"
          >
            {isReloading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Fetching…
              </span>
            ) : (
              "Analyze Handles"
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setRows([]);
              setErrors([]);
              setLastUpdatedAt(null);
            }}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-white/15 bg-transparent px-5 text-sm font-semibold text-white/70 transition hover:border-white/40 hover:text-white sm:flex-none sm:px-6"
          >
            Clear Results
          </button>
        </div>
        <p className="text-xs text-slate-200/60">
          Paste handles separated by spaces, commas, or new lines. Public accounts
          only.
        </p>
      </form>

      {errors.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          <p className="font-semibold">Heads up:</p>
          <ul className="mt-2 space-y-1">
            {errors.map((error) => (
              <li key={`${error.handle}-${error.message}`}>
                <span className="font-medium">
                  {error.handle === "request" ? "Request" : `@${error.handle}`}:
                </span>{" "}
                <span>{error.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Account Comparison</h2>
            <p className="text-xs text-slate-200/60">
              {rows.length
                ? `Showing ${rows.length} account${rows.length === 1 ? "" : "s"}.`
                : "No accounts analyzed yet."}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!rows.length}
              className="rounded-xl border border-white/15 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-slate-400"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void exportExcel()}
              disabled={!rows.length}
              className="rounded-xl border border-white/15 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-slate-400"
            >
              Export Excel
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-300">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      className="inline-flex items-center gap-2 font-semibold text-white/80 transition hover:text-white"
                    >
                      {column.label}
                      {sortKey === column.key && (
                        <span
                          className={`h-2.5 w-2.5 rotate-45 border-r border-t ${
                            sortOrder === "asc" ? "mt-0.5" : "-mt-0.5"
                          }`}
                        />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {sortedRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={columns.length}>
                    {isReloading
                      ? "Fetching account insights…"
                      : "Run an analysis to populate this dashboard."}
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={row.handle} className="hover:bg-white/5">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-3 ${
                          column.isNumeric ? "text-right tabular-nums" : ""
                        }`}
                      >
                        {formatCell(row, column)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {lastUpdatedAt && (
          <p className="text-right text-xs text-slate-400">
            Refreshed {lastUpdatedAt.toLocaleTimeString()}
          </p>
        )}
      </section>
    </div>
  );
}

function extractSortValue(row: InstagramMetrics, key: ColumnKey) {
  switch (key) {
    case "displayName":
      return row.displayName;
    case "handle":
      return row.handle;
    case "followers":
      return row.followers;
    case "averageViews":
      return row.averageViews;
    case "engagementRate":
      return row.engagementRate;
    case "category":
      return row.category;
    case "location":
      return row.location;
    case "averageLikes":
      return row.averageLikes;
    default:
      return null;
  }
}

function formatCellForExport(row: InstagramMetrics, column: ColumnDefinition): string {
  const value = (row as Record<string, unknown>)[column.key];

  if (value === null || value === undefined) return "";

  switch (column.key) {
    case "handle":
      return `@${value}`;
    case "followers":
    case "averageViews":
    case "averageLikes":
      if (typeof value === "number") return standardNumber.format(value);
      return String(value);
    case "engagementRate":
      return typeof value === "number" ? value.toFixed(2) : String(value);
    default:
      return String(value);
  }
}
