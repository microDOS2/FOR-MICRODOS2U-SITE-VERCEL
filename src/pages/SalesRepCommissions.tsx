import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CommissionView } from '@/components/CommissionView'
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
        .select('role')
        .eq('id', authUser.id)
        .single()

      if (profile?.role !== 'sales_rep') {
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-psy-neonPurple" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My Commissions</h1>
        <p className="text-gray-400 text-sm mt-1">
          Track your earnings from account purchases
        </p>
      </div>
      <CommissionView userId={user.id} role="rep" />
    </div>
  )
}
