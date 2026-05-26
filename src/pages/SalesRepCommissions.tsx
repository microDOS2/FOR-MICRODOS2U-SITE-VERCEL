import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CommissionView } from '@/components/CommissionView'
import { SalesRepSidebar } from '@/components/sales-rep/SalesRepSidebar'
import { Loader2 } from 'lucide-react'

export function SalesRepCommissions() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        navigate('/sales-rep-portal')
        return
      }

      // Verify role
      const { data: profile } = await supabase
        .from('users')
        .select('role,also_rep')
        .eq('id', authUser.id)
        .single()

      if (profile?.role !== 'sales_rep' && !(profile?.role === 'sales_manager' && profile?.also_rep)) {
        navigate('/')
        return
      }

      setUser(authUser)
      setLoading(false)
    }

    checkAuth()
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex">
        <SalesRepSidebar />
        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0514] flex">
      <SalesRepSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">My Commissions</h1>
            <p className="text-gray-400 text-sm mt-1">
              Track your earnings from account purchases
            </p>
          </div>
          <CommissionView userId={user.id} role="rep" />
        </div>
      </main>
    </div>
  )
}
