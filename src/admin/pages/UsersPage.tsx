import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Users, Plus, Search, Check, Copy, Store, UserPlus, Loader2, X, Info, Pencil
} from 'lucide-react'
import { toast } from 'sonner'
import type { DBUser } from '@/lib/supabase'

// ─── Audit Log Helper ───
async function logAudit(action: string, table_name: string, record_id: string, old_data: string | null, new_data: string | null) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('audit_log').insert({
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      user_id: session?.user?.id || null,
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }
}

// ─── Types ───
interface UnifiedUser {
  id: string
  source: 'users' | 'applications'
  business_name: string
  contact_name?: string | null
  email: string
  phone?: string | null
  role?: string | null
  account_type?: string | null
  status: string
  city?: string | null
  state?: string | null
  zip?: string | null
  license_number?: string | null
  ein?: string | null
  website?: string | null
  address?: string | null
  raw: DBUser | any
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  sales_manager: 'Sales Manager',
  sales_rep: 'Sales Rep',
  wholesaler: 'Wholesaler',
  distributor: 'Distributor',
  influencer: 'Influencer',
  shipping_fulfillment: 'Shipping / Fulfillment',
}

const roleBadgeClasses: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-500',
  sales_manager: 'bg-purple-500/20 text-purple-500',
  sales_rep: 'bg-blue-500/20 text-blue-500',
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
  influencer: 'bg-orange-500/20 text-orange-500',
  shipping_fulfillment: 'bg-cyan-500/20 text-cyan-500',
}

const ALL_US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'GU', 'VI', 'AS', 'MP',
]

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico', GU: 'Guam', VI: 'Virgin Islands',
  AS: 'American Samoa', MP: 'Northern Mariana Islands',
}

function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export function UsersPage() {
  const [allAccounts, setAllAccounts] = useState<UnifiedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Create user modal state (INTERNAL ROLES ONLY)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)

  // Add account modal state (BUSINESS ACCOUNTS)
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [accountBusinessName, setAccountBusinessName] = useState('')
  const [accountContactName, setAccountContactName] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [accountType, setAccountType] = useState<'wholesaler' | 'distributor' | 'influencer'>('wholesaler')
  const [accountPhone, setAccountPhone] = useState('')
  const [accountAddress, setAccountAddress] = useState('')
  const [accountCity, setAccountCity] = useState('')
  const [accountState, setAccountState] = useState('')
  const [accountZip, setAccountZip] = useState('')
  const [accountLicense, setAccountLicense] = useState('')
  const [accountEin, setAccountEin] = useState('')
  const [addingAccount, setAddingAccount] = useState(false)

  // Edit user modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UnifiedUser | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editManagerId, setEditManagerId] = useState('')

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [copied, setCopied] = useState(false)

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Territory state management loading
  const [savingStates, setSavingStates] = useState<string | null>(null)

  // Manager state assignments map (replaces volume_estimate JSON)
  const [managerStateMap, setManagerStateMap] = useState<Map<string, string[]>>(new Map())

  // Details column data
  const [storeCountMap, setStoreCountMap] = useState<Map<string, number>>(new Map())
  const [accountRepMap, setAccountRepMap] = useState<Map<string, DBUser>>(new Map())

  // Sort state
  type SortColumn = 'name' | 'email' | 'role' | 'location'
  const [sortColumn, setSortColumn] = useState<SortColumn>('role')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Toggle filter state
  type FilterMode = 'all' | 'employees' | 'business'
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  const employeeRoles = ['admin', 'sales_manager', 'sales_rep', 'shipping_fulfillment']
  const businessRoles = ['wholesaler', 'distributor', 'influencer']

  // Inline manager assignment
  const [savingManager, setSavingManager] = useState<string | null>(null)

  // ─── Fetch approved users only ───
  const fetchAll = async () => {
    setLoading(true)
    try {
      // 1. Fetch approved users via RPC (bypasses RLS for admin)
      const { data: usersData, error: usersError } = await supabase
        .rpc('get_all_users')

      if (usersError) console.error('Users error:', usersError)

      const combined: UnifiedUser[] = []

      // Add approved users
      ;(usersData || []).forEach((u: DBUser) => {
        combined.push({
          id: u.id,
          source: 'users',
          business_name: u.business_name || u.email,
          contact_name: u.business_name || u.email,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status || 'approved',
          city: u.city,
          state: u.state,
          zip: u.zip,
          license_number: u.license_number,
          ein: u.ein,
          website: u.website,
          address: u.address,
          raw: u,
        })
      })

      setAllAccounts(combined)

      // 2. Fetch store counts per user
      const { data: storesData } = await supabase
        .from('wholesaler_store_locations')
        .select('user_id')
      const scMap = new Map<string, number>()
      ;(storesData || []).forEach((s: any) => {
        const uid = s.user_id
        if (uid) scMap.set(uid, (scMap.get(uid) || 0) + 1)
      })
      setStoreCountMap(scMap)

      // 3. Fetch account rep assignments
      const { data: raaData } = await supabase
        .from('rep_account_assignments')
        .select('account_id,rep_id')
      if (raaData && raaData.length > 0) {
        const repIds = raaData.map((a: any) => a.rep_id)
        const { data: repsData } = await supabase
          .from('users')
          .select('id,business_name,email')
          .in('id', repIds)
        const repMap = new Map<string, DBUser>()
        ;(repsData || []).forEach((r: any) => repMap.set(r.id, r))
        const arMap = new Map<string, DBUser>()
        ;(raaData || []).forEach((a: any) => {
          const rep = repMap.get(a.rep_id)
          if (rep) arMap.set(a.account_id, rep)
        })
        setAccountRepMap(arMap)
      }

      // 4. Fetch manager state assignments (replaces volume_estimate JSON)
      const { data: assignmentsData } = await supabase
        .from('manager_state_assignments')
        .select('manager_id,state_code')

      const map = new Map<string, string[]>()
      ;(assignmentsData || []).forEach((a: any) => {
        const existing = map.get(a.manager_id) || []
        existing.push(a.state_code)
        map.set(a.manager_id, existing)
      })
      map.forEach((states, id) => map.set(id, states.sort()))
      setManagerStateMap(map)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load accounts')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  // Filter
  const filtered = allAccounts.filter((a) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = (
      a.business_name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.role || '').toLowerCase().includes(q)
    )
    if (!matchesSearch) return false

    if (filterMode === 'employees') return employeeRoles.includes(a.role || '')
    if (filterMode === 'business') return businessRoles.includes(a.role || '')
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const getVal = (acct: UnifiedUser, col: SortColumn) => {
      switch (col) {
        case 'name': return acct.business_name.toLowerCase()
        case 'email': return acct.email.toLowerCase()
        case 'role': return (acct.role || acct.account_type || '').toLowerCase()
        case 'location': return `${acct.city || ''}, ${acct.state || ''}`.toLowerCase()
      }
    }
    const aVal = getVal(a, sortColumn)
    const bVal = getVal(b, sortColumn)
    let cmp = aVal.localeCompare(bVal)
    if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp
    // Multi-key fallback: role → name
    const roleCmp = ((a.role || '') as string).localeCompare((b.role || '') as string)
    if (roleCmp !== 0) return roleCmp
    return a.business_name.toLowerCase().localeCompare(b.business_name.toLowerCase())
  })

  const approvedCount = allAccounts.filter((a) => a.status === 'approved').length

  // ──── CREATE USER (internal roles only) ────
  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserRole) {
      toast.error('Please fill in all fields')
      return
    }
    const blockedRoles = ['wholesaler', 'distributor', 'influencer']
    if (blockedRoles.includes(newUserRole)) {
      toast.error(`"${roleLabels[newUserRole]}" accounts must be created via "Add Business Account"`)
      return
    }
    setCreatingUser(true)
    const password = generatePassword()
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password,
        options: { data: { business_name: newUserName, role: newUserRole } },
      })
      if (authError || !authData.user) {
        toast.error(authError?.message || 'Failed to create user')
        setCreatingUser(false)
        return
      }
      // Auto-confirm email so user can log in immediately (no verification email)
      await supabase.rpc('confirm_user_email', { p_email: newUserEmail })
      await supabase.from('users').insert({
        id: authData.user.id,
        email: newUserEmail,
        business_name: newUserName,
        plain_password: password,
        role: newUserRole,
        status: 'approved',
      })
      await fetchAll()
      setGeneratedPassword(password)
      setShowCreateModal(false)
      setShowPasswordModal(true)
      toast.success('User created!')
      setNewUserName('')
      setNewUserEmail('')
      setNewUserRole('')
    } catch (err: any) {
      toast.error(err?.message || 'Failed')
    }
    setCreatingUser(false)
  }

  // ──── ADD BUSINESS ACCOUNT ────
  const handleAddAccount = async () => {
    if (!accountBusinessName || !accountContactName || !accountEmail || !accountPassword || !accountLicense || !accountEin) {
      toast.error('Please fill in all required fields')
      return
    }
    setAddingAccount(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: accountEmail,
        password: accountPassword,
        options: { data: { business_name: accountBusinessName, role: accountType } },
      })
      if (authError || !authData.user) {
        toast.error(authError?.message || 'Failed to create account')
        setAddingAccount(false)
        return
      }
      await supabase.from('users').insert({
        id: authData.user.id,
        email: accountEmail,
        business_name: accountBusinessName,
        contact_name: accountContactName || null,
        plain_password: accountPassword,
        license_number: accountLicense,
        ein: accountEin,
        phone: accountPhone || null,
        address: accountAddress || null,
        city: accountCity || null,
        state: accountState || null,
        zip: accountZip || null,
        role: accountType,
        status: 'approved',
      })
      await fetchAll()
      toast.success(`${roleLabels[accountType]} account created!`)
      setShowAddAccountModal(false)
      setGeneratedPassword(accountPassword)
      setShowPasswordModal(true)
      setAccountBusinessName(''); setAccountContactName(''); setAccountEmail('')
      setAccountPassword(''); setAccountPhone(''); setAccountAddress('')
      setAccountCity(''); setAccountState(''); setAccountZip('')
      setAccountLicense(''); setAccountEin('')
    } catch (err: any) {
      toast.error(err?.message || 'Error')
    }
    setAddingAccount(false)
  }

  // ──── EDIT USER ────
  const openEdit = (user: UnifiedUser) => {
    setEditingUser(user)
    setEditName(user.business_name || '')
    setEditPhone(user.phone || '')
    setEditCity(user.city || '')
    setEditState(user.state || '')
    setEditStatus(user.status || 'approved')
    setEditPassword(user.raw?.plain_password || '')
    setEditManagerId(user.raw?.manager_id || '')
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return
    setSavingEdit(true)
    try {
      // Use RPC to bypass RLS and update any user
      const { error } = await supabase.rpc('update_user', {
        p_id: editingUser.id,
        p_business_name: editName,
        p_phone: editPhone || null,
        p_city: editCity || null,
        p_state: editState || null,
        p_status: editStatus,
      })
      // Update plain_password separately
      if (editPassword !== '') {
        if (editPassword.length < 6) {
          toast.error('Password must be at least 6 characters')
          setSavingEdit(false)
          return
        }
        await supabase.from('users').update({ plain_password: editPassword }).eq('id', editingUser.id)
        // Also update the actual Supabase Auth password via Edge Function
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const resp = await fetch('https://fildaxejimuvfrcqmoba.supabase.co/functions/v1/update-auth-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token || ''}`,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbGRheGVqaW11dmZyY3Ftb2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDg2OTUsImV4cCI6MjA5MTY4NDY5NX0.Pe3HHtbo1_OiUTSgnq0qGSgzkkcTxRJ01kfOxsv2Gig'
            },
            body: JSON.stringify({ user_id: editingUser.id, new_password: editPassword })
          })
          const result = await resp.json()
          if (!resp.ok || result.error) {
            console.error('Edge function error:', result)
            toast.error('Password saved but login update failed: ' + (result.error || 'Unknown error'))
          } else {
            console.log('Auth password updated:', result)
          }
        } catch (err: any) {
          console.error('Failed to call edge function:', err)
          toast.error('Password saved but login update failed: ' + (err?.message || 'Network error'))
        }
      }
      if (error) {
        toast.error('Failed to update: ' + error.message)
      } else {
        // Update manager_id if changed
        const oldManagerId = editingUser.raw?.manager_id || ''
        if (editManagerId !== oldManagerId) {
          const { error: mgrError } = await supabase.rpc('assign_manager', {
            target_user_id: editingUser.id,
            new_manager_id: editManagerId || null
          })
          if (mgrError) {
            toast.error('Profile updated but manager assignment failed: ' + mgrError.message)
            setSavingEdit(false)
            return
          }
          const newMgr = allAccounts.find(u => u.id === editManagerId)
          const oldMgr = allAccounts.find(u => u.id === oldManagerId)
          await logAudit(
            editManagerId ? 'manager_assigned' : 'manager_unassigned',
            'users',
            editingUser.id,
            oldMgr?.business_name || oldMgr?.email || oldManagerId || null,
            newMgr?.business_name || newMgr?.email || editManagerId || null
          )
        }
        toast.success('User updated!')
        setShowEditModal(false)
        await fetchAll()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error')
    }
    setSavingEdit(false)
  }

  // ──── ASSIGN MANAGER ────
  const handleAssignManager = async (accountId: string, managerId: string) => {
    setSavingManager(accountId)
    try {
      const { error } = await supabase.rpc('assign_manager', {
        target_user_id: accountId,
        new_manager_id: managerId || null
      })
      if (error) throw error
      setAllAccounts(prev => prev.map(a =>
        a.id === accountId ? { ...a, raw: { ...a.raw, manager_id: managerId || null } } : a
      ))
      const acct = allAccounts.find(a => a.id === accountId)
      const newMgr = allAccounts.find(u => u.id === managerId)
      const oldMgrId = acct?.raw?.manager_id
      const oldMgr = oldMgrId ? allAccounts.find(u => u.id === oldMgrId) : null
      await logAudit(
        managerId ? 'manager_assigned' : 'manager_unassigned',
        'users',
        accountId,
        oldMgr?.business_name || oldMgr?.email || oldMgrId || null,
        newMgr?.business_name || newMgr?.email || managerId || null
      )
      toast.success(managerId ? 'Manager assigned!' : 'Manager removed')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update manager')
      await fetchAll()
    }
    setSavingManager(null)
  }

  // ──── DELETE ────
  const handleDelete = async (user: UnifiedUser) => {
    if (!confirm(`Delete ${user.business_name}?`)) return
    setActionLoading(user.id + '-delete')
    try {
      if (user.source === 'users') {
        // Use RPC to bypass RLS and delete any user
        const { error } = await supabase.rpc('delete_user', { p_id: user.id })
        if (error) {
          toast.error('Delete failed: ' + error.message)
          setActionLoading(null)
          return
        }
      } else {
        await supabase.from('applications').delete().eq('id', user.id)
      }
      await logAudit('user_deleted', 'users', user.id, user.business_name || user.email || null, user.role || user.account_type || null)
      toast.success('Deleted')
      await fetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed')
    }
    setActionLoading(null)
  }

  // ──── TERRITORY STATE MANAGEMENT ────
  const handleAddState = async (managerId: string, state: string) => {
    setSavingStates(managerId)
    try {
      const current = managerStateMap.get(managerId) || []
      if (current.includes(state)) {
        setSavingStates(null)
        return
      }
      const { error } = await supabase.rpc('assign_state', {
        p_manager_id: managerId,
        p_state_code: state,
      })
      if (error) throw error
      setManagerStateMap(prev => {
        const next = new Map(prev)
        const existing = next.get(managerId) || []
        next.set(managerId, [...existing, state].sort())
        return next
      })
      const mgr = allAccounts.find(u => u.id === managerId)
      await logAudit('territory_state_added', 'manager_state_assignments', managerId, null, `${state} | ${mgr?.business_name || mgr?.email || managerId}`)
      toast.success(`${state} added to territory`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add state')
    }
    setSavingStates(null)
  }

  const handleRemoveState = async (managerId: string, state: string) => {
    setSavingStates(managerId)
    try {
      const { error } = await supabase.rpc('remove_state', {
        p_manager_id: managerId,
        p_state_code: state,
      })
      if (error) throw error
      setManagerStateMap(prev => {
        const next = new Map(prev)
        const existing = next.get(managerId) || []
        const filtered = existing.filter((s: string) => s !== state)
        if (filtered.length === 0) {
          next.delete(managerId)
        } else {
          next.set(managerId, filtered)
        }
        return next
      })
      const mgr = allAccounts.find(u => u.id === managerId)
      await logAudit('territory_state_removed', 'manager_state_assignments', managerId, `${state} | ${mgr?.business_name || mgr?.email || managerId}`, null)
      toast.success(`${state} removed from territory`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove state')
    }
    setSavingStates(null)
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Password copied')
  }

  const accountTypeLabel = () => {
    switch (accountType) {
      case 'wholesaler': return 'Wholesaler'
      case 'distributor': return 'Distributor'
      case 'influencer': return 'Influencer'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">User Management</h2>
          <p className="text-gray-400">
            {approvedCount} approved users
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddAccountModal(true)} className="bg-gradient-to-r from-[#ff66c4] to-[#9a02d0] text-white">
            <Store className="w-4 h-4 mr-1" /> Add Business Account
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">
            <Plus className="w-4 h-4 mr-1" /> Create User
          </Button>
        </div>
      </div>

      {/* Search + Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Search by name, email, role, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0a0514] border-white/10 text-white"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'employees', 'business'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterMode === mode
                  ? 'bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white'
                  : 'bg-[#0a0514] text-gray-400 border border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              {mode === 'all' && 'Show All'}
              {mode === 'employees' && 'Employees'}
              {mode === 'business' && 'Business Users'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── APPROVED USERS TABLE ─── */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#9a02d0]" />
            Approved Users ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {[
                      { key: 'name' as SortColumn, label: 'Name', align: 'left' },
                      { key: 'email' as SortColumn, label: 'Email', align: 'left' },
                      { key: 'role' as SortColumn, label: 'Role', align: 'left' },
                      { key: 'location' as SortColumn, label: 'Location', align: 'left' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${
                          sortColumn === col.key
                            ? 'text-[#44f80c]'
                            : 'text-gray-400 hover:text-white'
                        } ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                        onClick={() => {
                          if (sortColumn === col.key) {
                            setSortDirection((d) => d === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortColumn(col.key)
                            setSortDirection('asc')
                          }
                        }}
                      >
                        {col.label} {sortColumn === col.key && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    ))}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sorted.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-gray-500 py-8">No approved users found</td></tr>
                  )}
                  {sorted.map((account) => {
                    const role = account.role || ''
                    const displayName = account.business_name

                    return (
                      <tr key={account.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-white font-medium">{displayName}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">{account.email}</td>
                        <td className="px-4 py-3">
                          <Badge className={roleBadgeClasses[role] || 'bg-gray-500/20 text-gray-400'}>
                            {roleLabels[role] || role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm">
                          {account.city && account.state ? `${account.city}, ${account.state}` : '—'}
                        </td>
                        {/* ─── Details Column ─── */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {account.role === 'sales_manager' ? (
                              (() => {
                                const states = managerStateMap.get(account.id) || []
                                const isSaving = savingStates === account.id
                                const available = ALL_US_STATES.filter(s => !states.includes(s))
                                const teamReps = allAccounts.filter(u => u.role === 'sales_rep' && u.raw?.manager_id === account.id)
                                return (
                                  <div className="space-y-1.5">
                                    {states.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {states.map((s: string) => (
                                          <span key={s} className="inline-flex items-center gap-1 text-xs bg-[#44f80c]/20 text-[#44f80c] px-2 py-0.5 rounded group">
                                            {s}
                                            {!isSaving && (
                                              <button
                                                onClick={() => handleRemoveState(account.id, s)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-[#44f80c]/70 hover:text-[#44f80c]"
                                                title={`Remove ${s}`}
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            )}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-500">No territory states</span>
                                    )}
                                    {isSaving && (
                                      <div className="flex items-center gap-1 text-xs text-[#9a02d0]">
                                        <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                                      </div>
                                    )}
                                    {available.length > 0 && !isSaving && (
                                      <select
                                        key={available.length}
                                        className="text-xs bg-[#0a0514] border border-white/10 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-[#44f80c]/50 w-full max-w-[160px]"
                                        value=""
                                        onChange={(e) => { if (e.target.value) { handleAddState(account.id, e.target.value) } }}
                                      >
                                        <option value="">+ Add state...</option>
                                        {available.map(s => <option key={s} value={s}>{s} — {STATE_NAMES[s]}</option>)}
                                      </select>
                                    )}
                                    {available.length === 0 && states.length > 0 && !isSaving && (
                                      <span className="text-[10px] text-gray-500">All states assigned</span>
                                    )}
                                    {teamReps.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {teamReps.map((rep) => (
                                          <span key={rep.id} className="inline-flex items-center gap-1 text-xs bg-[#9a02d0]/20 text-[#9a02d0] px-2 py-0.5 rounded">
                                            <Users className="w-3 h-3" /> {rep.business_name || rep.email}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })()
                            ) : (account.role === 'wholesaler' || account.role === 'distributor') ? (
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap gap-1.5">
                                  <Badge className="bg-[#44f80c]/20 text-[#44f80c] text-xs">
                                    {storeCountMap.get(account.id) || 0} store{storeCountMap.get(account.id) === 1 ? '' : 's'}
                                  </Badge>
                                  {(() => {
                                    const rep = accountRepMap.get(account.id)
                                    if (rep) {
                                      return (
                                        <Badge className="bg-[#44f80c]/20 text-[#44f80c] text-xs">
                                          <Users className="w-3 h-3 mr-1" /> Rep: {rep.business_name || rep.email}
                                        </Badge>
                                      )
                                    }
                                    return (
                                      <Badge className="bg-gray-700 text-gray-400 text-xs">No Rep Assigned</Badge>
                                    )
                                  })()}
                                </div>
                                <select
                                  className="text-xs bg-[#0a0514] border border-white/10 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-[#44f80c]/50 w-full max-w-[140px]"
                                  value={account.raw?.manager_id || ''}
                                  onChange={(e) => handleAssignManager(account.id, e.target.value)}
                                  disabled={savingManager === account.id}
                                >
                                  <option value="">— No Manager —</option>
                                  {allAccounts.filter(u => u.role === 'sales_manager').map(m => (
                                    <option key={m.id} value={m.id}>{m.business_name || m.email}</option>
                                  ))}
                                </select>
                              </div>
                            ) : account.role === 'sales_rep' ? (
                              <select
                                className="text-xs bg-[#0a0514] border border-white/10 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-[#44f80c]/50 w-full max-w-[160px]"
                                value={account.raw?.manager_id || ''}
                                onChange={(e) => handleAssignManager(account.id, e.target.value)}
                                disabled={savingManager === account.id}
                              >
                                <option value="">— No Manager —</option>
                                {allAccounts.filter(u => u.role === 'sales_manager').map(m => (
                                  <option key={m.id} value={m.id}>{m.business_name || m.email}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-500">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" onClick={() => openEdit(account)} disabled={actionLoading === account.id + '-edit'}
                              className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 h-7 px-2">
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(account)} disabled={actionLoading === account.id + '-delete'}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 px-2">
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ CREATE USER MODAL ═══ */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#150f24] border border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#9a02d0]" /> Create New User
            </DialogTitle>
            <DialogDescription className="text-gray-400">Create an internal team member account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Full Name</Label>
              <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="John Doe" className="bg-[#0a0514] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-300">Email</Label>
              <Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="john@microdos2.com" className="bg-[#0a0514] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-300">Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger className="bg-[#0a0514] border-white/10 text-white"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent className="bg-[#150f24] border-white/10">
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sales_manager">Sales Manager</SelectItem>
                  <SelectItem value="sales_rep">Sales Rep</SelectItem>
                  <SelectItem value="shipping_fulfillment">Shipping / Fulfillment</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-start gap-2 mt-2 p-2 bg-[#ff66c4]/10 border border-[#ff66c4]/20 rounded-lg">
                <Info className="w-4 h-4 text-[#ff66c4] mt-0.5 shrink-0" />
                <p className="text-xs text-[#ff66c4]">
                  Wholesaler, Distributor, and Influencer accounts must be created via <strong>Add Business Account</strong>.
                </p>
              </div>
            </div>
            <Button onClick={handleCreateUser} disabled={creatingUser} className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">
              {creatingUser ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create User & Generate Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ ADD BUSINESS ACCOUNT MODAL ═══ */}
      <Dialog open={showAddAccountModal} onOpenChange={setShowAddAccountModal}>
        <DialogContent className="bg-[#150f24] border border-white/10 text-white max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-[#ff66c4]" /> Add Business Account
            </DialogTitle>
            <DialogDescription className="text-gray-400">Create a business account tied to a licensed entity</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Account Type <span className="text-red-400">*</span></Label>
              <div className="flex gap-4 mt-1 flex-wrap">
                {(['wholesaler', 'distributor', 'influencer'] as const).map((t) => (
                  <label key={t} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${accountType === t ? 'border-[#9a02d0] bg-[#9a02d0]/10' : 'border-white/10 hover:border-white/30'}`}>
                    <input type="radio" name="acct_type" value={t} checked={accountType === t} onChange={() => setAccountType(t)} className="w-4 h-4 accent-[#9a02d0]" />
                    <span className="text-white">{roleLabels[t]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Business Name <span className="text-red-400">*</span></Label>
                <Input value={accountBusinessName} onChange={(e) => setAccountBusinessName(e.target.value)} placeholder="Acme Wellness" className="bg-[#0a0514] border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-gray-300">Contact Name <span className="text-red-400">*</span></Label>
                <Input value={accountContactName} onChange={(e) => setAccountContactName(e.target.value)} placeholder="John Doe" className="bg-[#0a0514] border-white/10 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Email <span className="text-red-400">*</span></Label>
                <Input type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="contact@acme.com" className="bg-[#0a0514] border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-gray-300">Password <span className="text-red-400">*</span></Label>
                <PasswordInput value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Min 6 characters" showLockIcon={false} className="bg-[#0a0514] border-white/10 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Business License # <span className="text-red-400">*</span></Label>
                <Input value={accountLicense} onChange={(e) => setAccountLicense(e.target.value)} placeholder="CA-PSY-001" className="bg-[#0a0514] border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-gray-300">EIN/TaxID # <span className="text-red-400">*</span></Label>
                <Input value={accountEin} onChange={(e) => setAccountEin(e.target.value)} placeholder="12-3456789" className="bg-[#0a0514] border-white/10 text-white" />
              </div>
            </div>
            <div>
              <Label className="text-gray-300">Phone</Label>
              <Input value={accountPhone} onChange={(e) => setAccountPhone(e.target.value)} placeholder="(555) 123-4567" className="bg-[#0a0514] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-300">Address</Label>
              <Input value={accountAddress} onChange={(e) => setAccountAddress(e.target.value)} placeholder="123 Main St" className="bg-[#0a0514] border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-gray-300">City</Label><Input value={accountCity} onChange={(e) => setAccountCity(e.target.value)} placeholder="Los Angeles" className="bg-[#0a0514] border-white/10 text-white" /></div>
              <div><Label className="text-gray-300">State</Label><Input value={accountState} onChange={(e) => setAccountState(e.target.value)} placeholder="CA" className="bg-[#0a0514] border-white/10 text-white" /></div>
              <div><Label className="text-gray-300">ZIP</Label><Input value={accountZip} onChange={(e) => setAccountZip(e.target.value)} placeholder="90001" className="bg-[#0a0514] border-white/10 text-white" /></div>
            </div>
            <Button onClick={handleAddAccount} disabled={addingAccount} className="w-full bg-gradient-to-r from-[#ff66c4] to-[#9a02d0] text-white">
              {addingAccount ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Store className="w-4 h-4 mr-2" />}
              Create {accountTypeLabel()} Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ EDIT USER MODAL ═══ */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#150f24] border border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-400" /> Edit User
            </DialogTitle>
            <DialogDescription className="text-gray-400">Update account information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">{(['wholesaler', 'distributor', 'influencer'].includes(editingUser?.role || '')) ? 'Business Name' : 'Full Name'}</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-[#0a0514] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-300">Phone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="bg-[#0a0514] border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300">City</Label>
                <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} className="bg-[#0a0514] border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-gray-300">State</Label>
                <Input value={editState} onChange={(e) => setEditState(e.target.value)} className="bg-[#0a0514] border-white/10 text-white" />
              </div>
            </div>
            <div>
              <Label className="text-gray-300">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="bg-[#0a0514] border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#150f24] border-white/10">
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingUser && ['sales_rep', 'wholesaler', 'distributor', 'influencer'].includes(editingUser.role || '') && (
              <div>
                <Label className="text-gray-300">Sales Manager</Label>
                <select
                  className="w-full bg-[#0a0514] border border-white/10 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-[#44f80c]/50"
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                >
                  <option value="">— No Manager —</option>
                  {allAccounts.filter(u => u.role === 'sales_manager').map(m => (
                    <option key={m.id} value={m.id}>{m.business_name || m.email}</option>
                  ))}
                </select>
              </div>
            )}
            {editingUser && ['sales_rep', 'sales_manager', 'admin'].includes(editingUser.role || '') && (
              <div>
                <Label className="text-gray-300">Password</Label>
                <Input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="bg-[#0a0514] border-white/10 text-white font-mono"
                  placeholder="Enter or change password"
                />
                <p className="text-[10px] text-gray-500 mt-1">Leave blank to keep current password</p>
              </div>
            )}
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="w-full bg-gradient-to-r from-blue-500 to-[#9a02d0] text-white">
              {savingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ PASSWORD MODAL ═══ */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="bg-[#150f24] border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#44f80c]" /> Account Created
            </DialogTitle>
            <DialogDescription className="text-gray-400">Copy and securely share these credentials</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-[#0a0514] p-4 rounded-lg border border-white/10">
              <Label className="text-gray-400 text-sm mb-2 block">Temporary Password</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-[#150f24] p-3 rounded text-[#44f80c] font-mono text-lg break-all">{generatedPassword}</code>
                <Button onClick={copyPassword} variant="outline" className="border-white/10 shrink-0">
                  {copied ? <Check className="w-4 h-4 text-[#44f80c]" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <p className="text-gray-400 text-sm">The user will be prompted to change this password on first login.</p>
            <Button onClick={() => setShowPasswordModal(false)} className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
