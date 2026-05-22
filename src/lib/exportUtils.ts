export type ExportFormat = 'csv';

export interface ExportColumn {
  header: string;
  key: string;
  formatter?: (value: any, row: any) => string;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

function formatCell(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function exportData(
  _format: ExportFormat,
  data: any[],
  columns: ExportColumn[],
  filename: string,
  _title?: string
) {
  const headers = columns.map((c) => `"${c.header}"`).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const rawValue = col.formatter
          ? col.formatter(row[col.key], row)
          : row[col.key];
        const cell = formatCell(rawValue);
        return `"${cell.replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${sanitizeFilename(filename)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export const orderColumns: ExportColumn[] = [
  { header: 'PO Number', key: 'po_number' },
  { header: 'Date', key: 'created_at', formatter: (v) => (v ? new Date(v).toLocaleDateString() : '') },
  { header: 'Items', key: 'items' },
  { header: 'Total', key: 'total', formatter: (v) => (v ? `$${Number(v).toLocaleString()}` : '$0') },
  { header: 'Status', key: 'status' },
  { header: 'Notes', key: 'notes', formatter: (v) => (v ? String(v).replace(/;\s*/g, ', ') : '') },
];

export const invoiceColumns: ExportColumn[] = [
  { header: 'Invoice #', key: 'invoice_number' },
  { header: 'PO Reference', key: 'po_number', formatter: (_v, row) => row.orders?.po_number || (row.order_id ? row.order_id.slice(0, 8) : 'N/A') },
  { header: 'Amount', key: 'amount', formatter: (v) => (v ? `$${Number(v).toLocaleString()}` : '$0') },
  { header: 'Status', key: 'status' },
  { header: 'Date', key: 'date', formatter: (v) => (v ? new Date(v).toLocaleDateString() : '') },
  { header: 'Due Date', key: 'due_date', formatter: (v) => (v ? new Date(v).toLocaleDateString() : '') },
];

export const storeColumns: ExportColumn[] = [
  { header: 'Store Name', key: 'name' },
  { header: 'Address', key: 'address' },
  { header: 'City', key: 'city' },
  { header: 'State', key: 'state' },
  { header: 'ZIP', key: 'zip' },
  { header: 'Phone', key: 'phone' },
  { header: 'Email', key: 'email' },
  { header: 'Website', key: 'website' },
  { header: 'Stock', key: 'stock' },
  { header: 'Is Primary', key: 'is_primary', formatter: (v) => v ? 'Yes' : 'No' },
  { header: 'Is Active', key: 'is_active', formatter: (v) => v ? 'Yes' : 'No' },
];

export const storeAdminColumns: ExportColumn[] = [
  ...storeColumns,
  { header: 'Owner Email', key: 'owner_email' },
  { header: 'Lat', key: 'lat' },
  { header: 'Lng', key: 'lng' },
];

// Parse CSV string into array of objects
export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

// Parse a single CSV line respecting quotes
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

