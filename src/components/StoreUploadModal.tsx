import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { parseCSV } from '@/lib/exportUtils';
import { geocodeAddress } from '@/lib/geocode';
import { Upload, X, Loader2, Check, AlertTriangle, Download } from 'lucide-react';

interface ParsedStore {
  row: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  stock: string;
  is_primary: boolean;
  owner_email?: string;
  lat: number | null;
  lng: number | null;
  status: 'pending' | 'geocoding' | 'ready' | 'error';
  error?: string;
}

interface StoreUploadModalProps {
  onClose: () => void;
  onImport: (stores: ParsedStore[]) => Promise<void>;
  isAdmin?: boolean;
}

export function StoreUploadModal({ onClose, onImport, isAdmin = false }: StoreUploadModalProps) {
  const [parsed, setParsed] = useState<ParsedStore[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const rows = parseCSV(text);
      const stores: ParsedStore[] = rows.map((row, idx) => ({
        row: idx + 2,
        name: row['Store Name'] || row['name'] || '',
        address: row['Address'] || row['address'] || '',
        city: row['City'] || row['city'] || '',
        state: row['State'] || row['state'] || '',
        zip: row['ZIP'] || row['zip'] || row['Zip'] || '',
        phone: row['Phone'] || row['phone'] || '',
        email: row['Email'] || row['email'] || '',
        website: row['Website'] || row['website'] || '',
        stock: row['Stock'] || row['stock'] || 'In Stock',
        is_primary: (row['Is Primary'] || row['is_primary'] || '').toLowerCase() === 'true' || (row['Is Primary'] || row['is_primary'] || '').toLowerCase() === 'yes',
        owner_email: isAdmin ? (row['Owner Email'] || row['owner_email'] || '') : undefined,
        lat: null,
        lng: null,
        status: 'pending' as const,
        error: !row['Store Name'] && !row['name'] ? 'Store Name is required' : !row['Address'] && !row['address'] ? 'Address is required' : undefined,
      }));
      setParsed(stores);
    };
    reader.readAsText(file);
  }, [isAdmin]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
  }, [handleFile]);

  const geocodeAll = async () => {
    setGeocoding(true);
    const updated = [...parsed];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].error) continue;
      updated[i] = { ...updated[i], status: 'geocoding' };
      setParsed([...updated]);
      const fullAddress = [updated[i].address, updated[i].city, updated[i].state, updated[i].zip].filter(Boolean).join(', ');
      const result = await geocodeAddress(fullAddress);
      if (result) {
        updated[i] = { ...updated[i], lat: result.lat, lng: result.lng, status: 'ready' };
      } else {
        updated[i] = { ...updated[i], status: 'error', error: 'Could not geocode address' };
      }
      setParsed([...updated]);
    }
    setParsed([...updated]);
    setGeocoding(false);
  };

  const readyCount = parsed.filter(s => s.status === 'ready').length;
  const errorCount = parsed.filter(s => s.error || s.status === 'error').length;

  const downloadTemplate = () => {
    const headers = isAdmin
      ? 'Store Name,Address,City,State,ZIP,Phone,Email,Website,Stock,Is Primary,Owner Email\n'
      : 'Store Name,Address,City,State,ZIP,Phone,Email,Website,Stock,Is Primary\n';
    const example = isAdmin
      ? 'Downtown LA,123 Main St,Los Angeles,CA,90001,555-0100,store@co.com,www.co.com/dt,In Stock,true,wellness@co.com\nHollywood Branch,456 Sunset Blvd,Los Angeles,CA,90028,555-0200,hollywood@co.com,,,false,wellness@co.com\n'
      : 'Downtown LA,123 Main St,Los Angeles,CA,90001,555-0100,store@co.com,www.co.com/dt,In Stock,true\nHollywood Branch,456 Sunset Blvd,Los Angeles,CA,90028,555-0200,hollywood@co.com,,,false\n';
    const blob = new Blob([headers + example], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'store_upload_template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Upload Store Locations</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {parsed.length === 0 ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadTemplate} className="border-[#44f80c]/30 text-[#44f80c] hover:bg-[#44f80c]/10">
                  <Download className="w-4 h-4 mr-2" /> Download Template
                </Button>
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isDragging ? 'border-[#44f80c] bg-[#44f80c]/5' : 'border-white/10 hover:border-white/20'}`}
              >
                <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-300 font-medium">Drop CSV file here or click to browse</p>
                <p className="text-gray-500 text-sm mt-1">Columns: Store Name, Address, City, State, ZIP, Phone, Email, Website, Stock, Is Primary{isAdmin ? ', Owner Email' : ''}</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-400">Total: <strong className="text-white">{parsed.length}</strong></span>
                  <span className="text-[#44f80c]">Ready: <strong>{readyCount}</strong></span>
                  {errorCount > 0 && <span className="text-red-400">Errors: <strong>{errorCount}</strong></span>}
                </div>
                <div className="flex gap-2">
                  {parsed.some(s => s.status === 'pending' && !s.error) && (
                    <Button onClick={geocodeAll} disabled={geocoding} className="bg-[#9a02d0] hover:bg-[#7a01a8] text-white">
                      {geocoding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPinIcon className="w-4 h-4 mr-2" />}
                      {geocoding ? 'Geocoding...' : 'Geocode Addresses'}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setParsed([])} className="border-white/10 text-gray-400">Clear</Button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#0a0514]">
                    <tr className="border-b border-white/10">
                      <th className="text-left px-3 py-2 text-xs text-gray-400">Row</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-400">Name</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-400">Address</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-400">City, State</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-400">Status</th>
                      {isAdmin && <th className="text-left px-3 py-2 text-xs text-gray-400">Owner</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {parsed.map((s, i) => (
                      <tr key={i} className={s.error || s.status === 'error' ? 'bg-red-500/5' : s.status === 'ready' ? 'bg-emerald-500/5' : ''}>
                        <td className="px-3 py-2 text-gray-500">{s.row}</td>
                        <td className="px-3 py-2 text-white">{s.name || <span className="text-red-400 italic">Missing</span>}</td>
                        <td className="px-3 py-2 text-gray-300">{s.address}</td>
                        <td className="px-3 py-2 text-gray-400">{s.city}, {s.state}</td>
                        <td className="px-3 py-2">
                          {s.status === 'geocoding' && <span className="text-yellow-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Geocoding</span>}
                          {s.status === 'ready' && <span className="text-[#44f80c] flex items-center gap-1"><Check className="w-3 h-3" /> Ready</span>}
                          {s.status === 'pending' && !s.error && <span className="text-gray-500">Pending</span>}
                          {(s.error || s.status === 'error') && <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {s.error}</span>}
                        </td>
                        {isAdmin && <td className="px-3 py-2 text-gray-400">{s.owner_email || '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-white/10">
          <Button variant="outline" onClick={onClose} className="border-white/10 text-gray-400">Cancel</Button>
          <Button
            onClick={() => { setImporting(true); onImport(parsed.filter(s => s.status === 'ready')).finally(() => setImporting(false)); }}
            disabled={readyCount === 0 || importing}
            className="bg-[#44f80c] hover:bg-[#3ad60a] text-[#0a0514] disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import {readyCount} Store{readyCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}
