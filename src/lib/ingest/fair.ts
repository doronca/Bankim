import * as XLSX from "xlsx";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";

// Fair.co.il portfolio statement parser (CSV or XLS/XLSX upload).
// Fair statements don't have a stable public schema, so this parser is
// column-name tolerant: it looks for common Hebrew/English header variants
// rather than assuming fixed column positions.

interface ParsedRow {
  accountName: string;
  date: Date;
  totalValue: number;
  currency: string;
}

const HEADER_ALIASES: Record<keyof ParsedRow, string[]> = {
  accountName: ["חשבון", "תיק", "account", "portfolio"],
  date: ["תאריך", "date"],
  totalValue: ["שווי", "שווי תיק", "value", "total value", "balance"],
  currency: ["מטבע", "currency"],
};

function findHeaderKey(headers: string[], aliases: string[]): string | undefined {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => h.includes(alias.toLowerCase()));
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

function rowsToParsed(rows: Record<string, unknown>[]): ParsedRow[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);

  const cols = {
    accountName: findHeaderKey(headers, HEADER_ALIASES.accountName),
    date: findHeaderKey(headers, HEADER_ALIASES.date),
    totalValue: findHeaderKey(headers, HEADER_ALIASES.totalValue),
    currency: findHeaderKey(headers, HEADER_ALIASES.currency),
  };

  if (!cols.date || !cols.totalValue) {
    throw new Error(
      `Could not find required columns (date, value) in Fair statement. Found headers: ${headers.join(", ")}`
    );
  }

  return rows
    .map((row) => {
      const rawDate = row[cols.date!];
      const rawValue = row[cols.totalValue!];
      const date =
        typeof rawDate === "number"
          ? XLSX.SSF.parse_date_code(rawDate)
            ? new Date(XLSX.SSF.format("yyyy-mm-dd", rawDate))
            : new Date()
          : new Date(String(rawDate));
      const totalValue = Number(String(rawValue).replace(/[^0-9.-]/g, ""));

      return {
        accountName: cols.accountName ? String(row[cols.accountName] ?? "Fair Portfolio") : "Fair Portfolio",
        date,
        totalValue,
        currency: cols.currency ? String(row[cols.currency]) : "ILS",
      };
    })
    .filter((r) => !isNaN(r.totalValue) && !isNaN(r.date.getTime()));
}

export function parseFairFile(buffer: Buffer, filename: string): ParsedRow[] {
  if (filename.toLowerCase().endsWith(".csv")) {
    const text = buffer.toString("utf-8");
    const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    return rowsToParsed(result.data);
  }

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rowsToParsed(rows);
}

// Persists parsed rows: one AccountMapping per distinct accountName (mapped
// null-entity until onboarding assigns it), one PortfolioSnapshot per row.
export async function importFairFile(buffer: Buffer, filename: string) {
  const rows = parseFairFile(buffer, filename);

  const upload = await prisma.fileUpload.create({
    data: { filename, source: "fair", rowCount: rows.length },
  });

  let imported = 0;
  for (const row of rows) {
    const mapping = await prisma.accountMapping.upsert({
      where: { source_externalId: { source: "fair", externalId: row.accountName } },
      update: {},
      create: {
        source: "fair",
        externalId: row.accountName,
        displayName: row.accountName,
        accountType: "investment_portfolio",
        currency: row.currency,
      },
    });

    await prisma.portfolioSnapshot.create({
      data: {
        accountMappingId: mapping.id,
        asOfDate: row.date,
        totalValue: row.totalValue,
        currency: row.currency,
        sourceFile: filename,
      },
    });
    imported++;
  }

  return { uploadId: upload.id, imported };
}
