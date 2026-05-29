import { useState } from 'react';
import { Download, ChevronDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportData, type ExportColumn } from '@/lib/exportUtils';

interface ExportDropdownProps {
  data: any[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  disabled?: boolean;
}

export function ExportDropdown({
  data,
  columns,
  filename,
  title,
  label = 'Export',
  variant = 'outline',
  size = 'sm',
  className = '',
  disabled = false,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);

  const handleExport = () => {
    if (data.length === 0) return;
    exportData('csv', data, columns, filename, title);
    setOpen(false);
  };

  return (
    <div className="relative inline-block">
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || data.length === 0}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Download className="w-4 h-4" />
        {label}
        {size !== 'icon' && <ChevronDown className="w-3 h-3 ml-1.5" />}
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-44 bg-[#150f24] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
            <button
              onClick={handleExport}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#9a02d0]/20 hover:text-white transition-colors"
            >
              <FileText className="w-4 h-4 text-[#44f80c]" />
              <div>
                <div className="font-medium">CSV</div>
                <div className="text-xs text-gray-500">Spreadsheet</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
