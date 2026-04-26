import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ShoppingCart, Receipt, FileText, AlertCircle } from 'lucide-react'

interface Stats {
  totalOrders: number
  pendingOrders: number
  openInvoices: number
  pendingAgreements: number
}

interface DistributorStatsProps {
  userId: string
}

export function DistributorStats({ userId }: DistributorStatsProps) {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    pendingOrders: 0,
    openInvoices: 0,
    pendingAgreements: 0,
  })

  useEffect(() => {
    async function fetchStats() {
      // Total orders
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      // Pending orders
      const { count: pendingOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending')

      // Open invoices
      const { data: openInvoicesData } = await supabase
        .from('invoices')
        .select('amount')
        .eq('user_id', userId)
        .eq('status', 'open')

      // Pending agreements
      const { count: pendingAgreements } = await supabase
        .from('agreements')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending')

      setStats({
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        openInvoices: (openInvoicesData || []).reduce((sum, inv) => sum + (inv.amount || 0), 0),
        pendingAgreements: pendingAgreements || 0,
      })
    }

    fetchStats()
  }, [userId])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-[#150f24] border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <ShoppingCart className="w-5 h-5 text-[#44f80c]" />
          <span className="text-2xl font-bold text-white">{stats.totalOrders}</span>
        </div>
        <p className="text-gray-400 text-sm">Total Orders</p>
      </div>

      <div className="bg-[#150f24] border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <AlertCircle className="w-5 h-5 text-yellow-400" />
          <span className="text-2xl font-bold text-white">{stats.pendingOrders}</span>
        </div>
        <p className="text-gray-400 text-sm">Pending Orders</p>
      </div>

      <div className="bg-[#150f24] border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <Receipt className="w-5 h-5 text-[#9a02d0]" />
          <span className="text-2xl font-bold text-white">${stats.openInvoices.toLocaleString()}</span>
        </div>
        <p className="text-gray-400 text-sm">Open Invoices</p>
      </div>

      <div className="bg-[#150f24] border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <FileText className="w-5 h-5 text-[#ff66c4]" />
          <span className="text-2xl font-bold text-white">{stats.pendingAgreements}</span>
        </div>
        <p className="text-gray-400 text-sm">Pending Agreements</p>
      </div>
    </div>
  )
}
