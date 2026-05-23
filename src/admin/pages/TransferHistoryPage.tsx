import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  Search,
  Download,
  ArrowRightLeft,
  Check,
  X,
  Clock,
  Loader2,
  Users,
  Shield,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface TransferItem {
  id: string
  rep_id: string
  account_id: string
  old_manager_id: string | null
  new_manager_id: string | null
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  resolved_at: string | null
  rep: { id: string; business_name: string | null; email: string | null }
  account: { id: string; business_name: string | null; role: string | null }
  old_manager: { id: string; business_name: string | null; email: string | null }
  new_manager: { id: string; business_name: string | null; email: string | null }
}

const statusColors: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  accepted: 'text-[#44f80c] bg-[#44f80c]/10 border-[#44f80c]/20',
  rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const statusIcons: Record<string, any> = {
  pending: Clock,
  accepted: Check,
  rejected: X,
}

export function TransferHistoryPage() {
  const [transfers, setTransfers] = useState<TransferItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  useEffect(() => {
    fetchTransfers()
  }, [])

  const fetchTransfers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_all_transfers')
      if (error) {
        toast.error('Failed to load transfers: ' + error.message)
        setTransfers([])
      } else {
        setTransfers(data || [])
      }
    } catch (e) {
      toast.error('Failed to load transfers')
      setTransfers([])
    }
    setLoading(false)
  }

  const filtered = transfers.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    const term = search.toLowerCase()
    const matchesSearch =
      !term ||
      (t.rep?.business_name || t.rep?.email || '').toLowerCase().includes(term) ||
      (t.account?.business_name || '').toLowerCase().includes(term) ||
      (t.old_manager?.business_name || t.old_manager?.email || '').toLowerCase().includes(term) ||
      (t.new_manager?.business_name || t.new_manager?.email || '').toLowerCase().includes(term)
    return matchesStatus && matchesSearch
  })

  const handleAdminResolve = async (transferId: string, status: 'accepted' | 'rejected') => {
    if (!confirm(`Admin override: mark this transfer as ${status}?`)) return
    setResolvingId(transferId)
    const { error } = await supabase.from('assignment_transfers')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', transferId)
    if (error) {
      toast.error('Failed: ' + error.message)
    } else {
      toast.success(`Transfer ${status}`)
      await fetchTransfers()
    }
    setResolvingId(null)
  }

  const exportCSV = () => {
    const rows = filtered.map((t) => [
      t.id,
      t.rep?.business_name || t.rep?.email || '—',
      t.account?.business_name || '—',
      t.account?.role || '—',
      t.old_manager?.business_name || t.old_manager?.email || '—',
      t.new_manager?.business_name || t.new_manager?.email || '—',
      t.status,
      new Date(t.created_at).toLocaleString(),
      t.resolved_at ? new Date(t.resolved_at).toLocaleString() : '—',
    ])
    const csv = [
      ['ID', 'Rep', 'Account', 'Account Role', 'Old Manager', 'New Manager', 'Status', 'Created', 'Resolved'].join(','),
      ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transfer-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search rep, account, or manager..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-400/10 text-yellow-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{transfers.filter((t) => t.status === 'pending').length}</p>
              <p className="text-sm text-gray-400">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#44f80c]/10 text-[#44f80c]">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{transfers.filter((t) => t.status === 'accepted').length}</p>
              <p className="text-sm text-gray-400">Accepted</p>
            </div>
          </div>
        </div>
        <div className="bg-[#150f24] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-400/10 text-red-400">
              <X className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{transfers.filter((t) => t.status === 'rejected').length}</p>
              <p className="text-sm text-gray-400">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#150f24] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Rep</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Account</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Old Manager</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">New Manager</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Resolved</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading transfers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <ArrowRightLeft className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-400">No transfers found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((transfer) => {
                  const StatusIcon = statusIcons[transfer.status] || Clock
                  const statusClass = statusColors[transfer.status] || statusColors.pending
                  return (
                    <tr key={transfer.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', statusClass)}>
                          <StatusIcon className="w-3 h-3" />
                          <span className="capitalize">{transfer.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-sm text-white">
                            {transfer.rep?.business_name || transfer.rep?.email || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-white">
                            {transfer.account?.business_name || '—'}
                          </span>
                          {transfer.account?.role && (
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-medium w-fit',
                              transfer.account.role === 'distributor'
                                ? 'bg-[#ff66c4]/20 text-[#ff66c4]'
                                : 'bg-[#44f80c]/20 text-[#44f80c]'
                            )}>
                              {transfer.account.role === 'distributor' ? 'Distributor' : 'Wholesaler'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-sm text-gray-300">
                            {transfer.old_manager?.business_name || transfer.old_manager?.email || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-sm text-gray-300">
                            {transfer.new_manager?.business_name || transfer.new_manager?.email || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(transfer.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {transfer.resolved_at ? formatDate(transfer.resolved_at) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {transfer.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAdminResolve(transfer.id, 'accepted')}
                              disabled={resolvingId === transfer.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#44f80c]/20 text-[#44f80c] hover:bg-[#44f80c]/30 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {resolvingId === transfer.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              Accept
                            </button>
                            <button
                              onClick={() => handleAdminResolve(transfer.id, 'rejected')}
                              disabled={resolvingId === transfer.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-400/10 text-red-400 hover:bg-red-400/20 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {resolvingId === transfer.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500 italic">Resolved</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Link to audit log */}
      <div className="flex items-center justify-end gap-2 text-sm text-gray-400">
        <ScrollText className="w-4 h-4" />
        <span>
          Transfer events are also logged in the{' '}
          <a href="#/admin/audit-log" className="text-[#9a02d0] hover:text-[#ff66c4] underline">
            Audit Log
          </a>
        </span>
      </div>
    </div>
  )
}
