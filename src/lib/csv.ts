import Papa from "papaparse";

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) {
    return columns ? columns.join(",") + "\n" : "";
  }
  return Papa.unparse(rows, { columns, header: true, escapeFormulae: true });
}

export function parseCsv<T = Record<string, string>>(input: string): T[] {
  const parsed = Papa.parse<T>(input, { header: true, skipEmptyLines: true });
  return parsed.data;
}
