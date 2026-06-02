import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'
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
  Users, Plus, Search, Check, Store, UserPlus, Loader2, X, Info, Pencil, Trash2, AlertTriangle, Download
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
  } catch (e: any) {
    console.error('[logAudit] Failed:', e);
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
  shipping_fulfillment: 'Shipping / Fulfillment',
}

const roleBadgeClasses: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-500',
  sales_manager: 'bg-purple-500/20 text-purple-500',
  sales_rep: 'bg-blue-500/20 text-blue-500',
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
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
  const [accountType, setAccountType] = useState<'wholesaler' | 'distributor'>('wholesaler')
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
  const [editContactName, setEditContactName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editManagerId, setEditManagerId] = useState('')
  const [editRepId, setEditRepId] = useState('')
  const [editAlsoRep, setEditAlsoRep] = useState(false)

  // Password modal
  const [showEmailSentModal, setShowEmailSentModal] = useState(false)
  const [sentEmailTo, setSentEmailTo] = useState('')

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Territory state management loading
  const [savingStates, setSavingStates] = useState<string | null>(null)

  // Manager state assignments map (replaces volume_estimate JSON)
  const [managerStateMap, setManagerStateMap] = useState<Map<string, string[]>>(new Map())

  // Details column data
  const [storeCountMap, setStoreCountMap] = useState<Map<string, number>>(new Map())
  const [accountRepMap, setAccountRepMap] = useState<Map<string, DBUser>>(new Map())
  const [lastLoginMap, setLastLoginMap] = useState<Map<string, string>>(new Map())

  // Sort state
  type SortColumn = 'name' | 'email' | 'role' | 'location' | 'website'
  const [sortColumn, setSortColumn] = useState<SortColumn>('role')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Toggle filter state
  type FilterMode = 'all' | 'employees' | 'business' | 'unassigned'
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  // Format last login timestamp
  const formatLastLogin = (iso: string | undefined) => {
    if (!iso) return <span className="text-gray-600">Never</span>
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return <span className="text-[#44f80c]">Just now</span>
    if (diffMins < 60) return <span className="text-[#44f80c]">{diffMins}m ago</span>
    if (diffHours < 24) return <span className="text-[#44f80c]">{diffHours}h ago</span>
    if (diffDays < 7) return <span className="text-gray-400">{diffDays}d ago</span>
    return <span className="text-gray-500">{d.toLocaleDateString()}</span>
  }

  const employeeRoles = ['admin', 'sales_manager', 'sales_rep', 'shipping_fulfillment']
  const businessRoles = ['wholesaler', 'distributor']
  const allKnownRoles = [...employeeRoles, ...businessRoles]

  // Inline manager assignment
  const [savingManager, setSavingManager] = useState<string | null>(null)

  // Delete all non-admin dialog
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  // ─── Fetch approved users only ───
  const fetchAll = async () => {
    setLoading(true)
    try {
      // 1. Fetch approved users via RPC (bypasses RLS for admin)
      const { data: usersData } = await supabase
        .rpc('get_all_users')


      const combined: UnifiedUser[] = []

      // Add approved users
      ;(usersData || []).forEach((u: DBUser) => {
        combined.push({
          id: u.id,
          source: 'users',
          business_name: u.business_name || u.email,
          contact_name: u.contact_name || u.business_name || u.email,
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

      // 3. Fetch auth user last login times
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/get-user-logins`, {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
        })
        if (resp.ok) {
          const { logins } = await resp.json()
          const llMap = new Map<string, string>()
          for (const [uid, ts] of Object.entries(logins)) {
            llMap.set(uid, ts as string)
          }
          setLastLoginMap(llMap)
        }
      } catch {
        // Best effort — last login is optional
      }

      // 4. Fetch account rep assignments
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
    if (filterMode === 'unassigned') return !a.role || !allKnownRoles.includes(a.role)
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
        case 'website': return (acct.website || '').toLowerCase()
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

  const filteredCount = filtered.length

  // ──── CREATE USER (internal roles only) ────
  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserRole) {
      toast.error('Please fill in all fields')
      return
    }
    const blockedRoles = ['wholesaler', 'distributor']
    if (blockedRoles.includes(newUserRole)) {
      toast.error(`"${roleLabels[newUserRole]}" accounts must be created via "Add Business Account"`)
      return
    }
    setCreatingUser(true)
    const password = generatePassword()
    try {
      // 1. Check if email already exists in public.users
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', newUserEmail)
        .maybeSingle()
      if (existingUser) {
        throw new Error('A user with this email already exists in the database')
      }

      // 2. Create auth user via Supabase signUp
      let userId: string
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: newUserEmail,
        password,
        options: {
          data: { business_name: newUserName, role: newUserRole },
        },
      })

      if (signUpData?.user) {
        // New user created successfully
        userId = signUpData.user.id
      } else if (signUpErr?.message?.toLowerCase().includes('already') || signUpErr?.code === 'user_already_exists') {
        // Auth user already exists (orphaned from a previous failed attempt).
        // Try to sign in with the generated password to recover the auth user ID.
        // Use a temporary client so we don't disturb the admin's session.
        const tempSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { storage: window.localStorage, autoRefreshToken: false }
        })
        const { data: signInData } = await tempSupabase.auth.signInWithPassword({
          email: newUserEmail,
          password,
        })
        if (signInData?.user) {
          userId = signInData.user.id
        } else {
          throw new Error(
            'This email is already registered with a different password. ' +
            'If a previous attempt failed, go to Supabase Dashboard → Authentication → Users, ' +
            'delete "' + newUserEmail + '", then try again. Or use a different email.'
          )
        }
      } else {
        throw new Error(signUpErr?.message || 'Failed to create auth user')
      }

      // 3. Insert into public.users table via RPC (bypasses RLS)
      const { error: insertErr } = await supabase.rpc('insert_user_admin', {
        p_id: userId,
        p_email: newUserEmail,
        p_business_name: newUserName,
        p_role: newUserRole,
        p_status: 'approved',
      })
      if (insertErr) throw new Error('Failed to insert user record: ' + insertErr.message)

      // 4. Send welcome email
      try {
        const emailResp = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            to: newUserEmail,
            subject: 'Welcome to microDOS(2)',
            html: `<p>Hi ${newUserName},</p><p>Your account has been created.</p><p><strong>Email:</strong> ${newUserEmail}<br><strong>Password:</strong> ${password}</p><p><a href="https://for-microdos-2-u-site-vercel.vercel.app">Log In</a></p>`,
          }),
        })
        if (!emailResp.ok) {
          const errText = await emailResp.text().catch(() => emailResp.statusText)
          console.error('[UsersPage] Welcome email failed:', emailResp.status, errText)
          toast.error(`Welcome email failed (${emailResp.status}). User created but email not sent.`)
        }
      } catch (e: any) {
        console.error('[UsersPage] Welcome email exception:', e)
        toast.error(`Welcome email failed: ${e.message}. User created but email not sent.`)
      }

      await fetchAll()
      setSentEmailTo(newUserEmail)
      setShowCreateModal(false)
      setShowEmailSentModal(true)
      toast.success(`User created! Password: ${password}`)
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
      // Create auth user directly via Supabase signUp (no edge function)
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: accountEmail,
        password: accountPassword,
        options: {
          data: { business_name: accountBusinessName, role: accountType },
        },
      })
      if (signUpErr || !signUpData.user) {
        throw new Error(signUpErr?.message || 'Failed to create account')
      }
      const userId = signUpData.user.id

      // Insert into public.users table (direct query, no RPC)
      const { error: insertErr } = await supabase.from('users').insert({
        id: userId,
        email: accountEmail,
        business_name: accountBusinessName,
        contact_name: accountContactName,
        phone: accountPhone || null,
        address: accountAddress || null,
        city: accountCity || null,
        state: accountState || null,
        zip: accountZip || null,
        license_number: accountLicense,
        ein: accountEin,
        role: accountType,
        status: 'approved',
      })
      if (insertErr) throw new Error('Failed to insert business account: ' + insertErr.message)

      await fetchAll()
      toast.success(`${roleLabels[accountType]} account created!`)
      setShowAddAccountModal(false)
      setSentEmailTo(accountEmail)
      setShowEmailSentModal(true)
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
    setEditContactName(user.contact_name || '')
    setEditPhone(user.phone || '')
    setEditCity(user.city || '')
    setEditState(user.state || '')
    setEditStatus(user.status || 'approved')
    setEditPassword('')
    setEditManagerId(user.raw?.manager_id || '')
    if (user.role === 'wholesaler' || user.role === 'distributor') {
      const assignment = accountRepMap.get(user.id)
      setEditRepId(assignment?.id || 'none')
    } else {
      setEditRepId('none')
    }
    setEditAlsoRep(user.raw?.also_rep || false)
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return
    setSavingEdit(true)
    try {
      // Update user directly via admin client
      const updateData: any = {
        business_name: editName,
        contact_name: editContactName || null,
        phone: editPhone || null,
        city: editCity || null,
        state: editState || null,
        status: editStatus,
      }
      // Only update also_rep for sales managers
      if (editingUser.role === 'sales_manager') {
        updateData.also_rep = editAlsoRep
      }
      const { error } = await supabase.from('users').update(updateData).eq('id', editingUser.id)

      // Update auth password if provided
      if (editPassword !== '') {
        if (editPassword.length < 6) {
          toast.error('Password must be at least 6 characters')
          setSavingEdit(false)
          return
        }
        try {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/update-auth-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ user_id: editingUser.id, new_password: editPassword })
          })
          const result = await resp.json()
          if (!resp.ok || result.error) {
            toast.error('Password update failed: ' + (result.error || 'Unknown error'))
          }
        } catch (err: any) {
          toast.error('Password update failed: ' + (err?.message || 'Network error'))
        }
      }
      if (error) {
        toast.error('Failed to update: ' + error.message)
      } else {
        // For business accounts: manage rep_account_assignments
        if (['wholesaler', 'distributor'].includes(editingUser.role || '')) {
          const currentRep = accountRepMap.get(editingUser.id)
          const currentRepId = currentRep?.id || 'none'
          const effectiveEditRepId = editRepId === 'none' ? '' : editRepId
          if (effectiveEditRepId !== currentRepId) {
            if (effectiveEditRepId) {
              const { error: repErr } = await supabase.rpc('assign_rep_to_account', {
                p_rep_id: effectiveEditRepId,
                p_account_id: editingUser.id,
                p_assigned_by: (await supabase.auth.getUser()).data.user?.id,
              })
              if (repErr) {
                toast.error('Profile updated but rep assignment failed: ' + repErr.message)
                setSavingEdit(false)
                return
              }
              const newRep = allAccounts.find(u => u.id === effectiveEditRepId)
              await logAudit('rep_assigned', 'rep_account_assignments', editingUser.id, currentRep?.business_name || currentRep?.email || null, newRep?.business_name || newRep?.email || null)
            } else {
              await supabase.from('rep_account_assignments').delete().eq('account_id', editingUser.id)
              await logAudit('rep_unassigned', 'rep_account_assignments', editingUser.id, currentRep?.business_name || currentRep?.email || null, null)
            }
          }
        }
        // For sales reps: manage manager_id
        if (editingUser.role === 'sales_rep') {
          const oldManagerId = editingUser.raw?.manager_id || 'none'
          const effectiveEditManagerId = editManagerId === 'none' ? '' : editManagerId
          if (effectiveEditManagerId !== oldManagerId) {
            const { error: mgrError } = await supabase.from('users').update({
              manager_id: effectiveEditManagerId || null
            }).eq('id', editingUser.id)
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
      const { error } = await supabase.from('users').update({
        manager_id: managerId || null
      }).eq('id', accountId)
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
        // 1. Clean up related records first (FK constraints)
        await supabase.from('assignment_transfers').delete().eq('rep_id', user.id)
        await supabase.from('assignment_transfers').delete().eq('account_id', user.id)
        await supabase.from('rep_account_assignments').delete().eq('rep_id', user.id)
        await supabase.from('rep_account_assignments').delete().eq('account_id', user.id)
        await supabase.from('manager_state_assignments').delete().eq('manager_id', user.id)

        // 2. Delete user
        const { error } = await supabase.from('users').delete().eq('id', user.id)
        if (error) {
          toast.error('Delete failed: ' + error.message)
          setActionLoading(null)
          return
        }

        // 3. Best-effort: also delete auth user via edge function
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/delete-auth-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ user_id: user.id }),
          })
        } catch (e: any) {
          console.error('[UsersPage] delete-auth-user failed:', e);
          toast.warning('Database user deleted but auth cleanup failed: ' + e.message);
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

  // ──── FULL DATABASE CLEANUP (pre-launch wipe) ────
  // Removes ALL data except admin accounts and products.
  // Call this ONCE before going live to clear all test data and start fresh.
  const handleDeleteAllNonAdmin = async () => {
    setDeletingAll(true)
    try {
      // 1. Identify all non-admin users
      const nonAdminUsers = allAccounts.filter(u => u.role !== 'admin' && u.source === 'users')
      if (nonAdminUsers.length === 0) {
        toast.info('No non-admin users to delete')
        setDeletingAll(false)
        setShowDeleteAllDialog(false)
        return
      }
      const nonAdminIds = nonAdminUsers.map(u => u.id)

      let results = {
        orderItems: 0, orders: 0, invoices: 0,
        stores: 0, agreements: 0, repAssignments: 0,
        stateAssignments: 0, transactions: 0,
        applications: 0, auditLog: 0, users: 0,
        commissions: 0, authFailed: 0,
        archivedReset: 0, shippingReset: 0,
        paidReset: 0, remindersReset: 0,
      }

      // ═══════════════════════════════════════════════
      // PHASE 1: RESET ALL FLAGS ON EXISTING RECORDS
      // ═══════════════════════════════════════════════

      // 1a. Reset archived_at on ALL orders
      const { data: rarO, error: rarOErr } = await supabase
        .from('orders').update({ archived_at: null })
        .neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      if (!rarOErr && rarO) results.archivedReset += rarO.length

      // 1b. Reset archived_at on ALL invoices
      const { data: rarI, error: rarIErr } = await supabase
        .from('invoices').update({ archived_at: null })
        .neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      if (!rarIErr && rarI) results.archivedReset += rarI.length

      // 1c. Clear shipped_date, carrier, tracking_number on ALL orders
      const { data: rsData, error: rsErr } = await supabase
        .from('orders').update({ shipped_date: null, carrier: null, tracking_number: null })
        .neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      if (!rsErr && rsData) results.shippingReset = rsData.length

      // 1d. Clear paid_at, paid_method, paid_reference on ALL invoices
      const { data: rpData, error: rpErr } = await supabase
        .from('invoices').update({ paid_at: null, paid_method: null, paid_reference: null })
        .neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      if (!rpErr && rpData) results.paidReset = rpData.length

      // 1e. Reset reminder_sent_at and reminder_count on ALL invoices
      const { data: rrData, error: rrErr } = await supabase
        .from('invoices').update({ reminder_sent_at: null, reminder_count: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      if (!rrErr && rrData) results.remindersReset = rrData.length

      // ═══════════════════════════════════════════════
      // PHASE 2: DELETE ALL ORDERS AND INVOICES (ALL USERS)
      // ═══════════════════════════════════════════════

      // 2a. Fetch ALL order IDs, then delete order items
      const { data: allOrderIds } = await supabase.from('orders').select('id').limit(10000)
      const orderIdList = (allOrderIds || []).map((r: any) => r.id)
      if (orderIdList.length > 0) {
        const { data: oiData, error: oiErr } = await supabase
          .from('order_items').delete().in('order_id', orderIdList).select('id')
        if (!oiErr && oiData) results.orderItems = oiData.length
      }

      // 2b. Delete ALL orders (admin + non-admin test orders)
      const { data: oData, error: oErr } = await supabase
        .from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      if (!oErr && oData) results.orders = oData.length

      // 2c. Delete ALL invoices
      const { data: iData, error: iErr } = await supabase
        .from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      if (!iErr && iData) results.invoices = iData.length

      // ═══════════════════════════════════════════════
      // PHASE 3: DELETE ALL COMMISSION PAYMENTS
      // ═══════════════════════════════════════════════

      const { data: cpData, error: cpErr } = await supabase
        .from('commission_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      if (!cpErr && cpData) results.commissions = cpData.length

      // ═══════════════════════════════════════════════
      // PHASE 4: DELETE NON-ADMIN USER DATA
      // ═══════════════════════════════════════════════

      // 4a. Delete store locations
      const { data: sData, error: sErr } = await supabase
        .from('wholesaler_store_locations').delete().in('user_id', nonAdminIds).select('id')
      if (!sErr && sData) results.stores = sData.length

      // 4b. Delete agreements
      const { data: aData, error: aErr } = await supabase
        .from('agreements').delete().in('user_id', nonAdminIds).select('id')
      if (!aErr && aData) results.agreements = aData.length

      // 4c. Delete transactions
      const { data: tData, error: tErr } = await supabase
        .from('transactions').delete().in('user_id', nonAdminIds).select('id')
      if (!tErr && tData) results.transactions = tData.length

      // 4d. Delete rep-account assignments
      const { data: raData, error: raErr } = await supabase
        .from('rep_account_assignments').delete()
        .or(`account_id.in.(${nonAdminIds.join(',')}),rep_id.in.(${nonAdminIds.join(',')})`)
        .select('id')
      if (!raErr && raData) results.repAssignments = raData.length

      // 4e. Delete manager state assignments
      const { data: msData, error: msErr } = await supabase
        .from('manager_state_assignments').delete().in('manager_id', nonAdminIds).select('id')
      if (!msErr && msData) results.stateAssignments = msData.length

      // ═══════════════════════════════════════════════
      // PHASE 5: DELETE GLOBAL TABLES
      // ═══════════════════════════════════════════════

      // 5a. Delete ALL applications
      const { data: appData, error: appErr } = await supabase
        .from('applications').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      if (!appErr && appData) results.applications = appData.length

      // 5b. Delete ALL audit logs
      const { data: alData, error: alErr } = await supabase
        .from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      if (!alErr && alData) results.auditLog = alData.length

      // ═══════════════════════════════════════════════
      // PHASE 6: DELETE NON-ADMIN USERS
      // ═══════════════════════════════════════════════

      let userDeleted = 0
      let userFailed = 0
      for (const u of nonAdminUsers) {
        // Try to delete auth user first (best effort via edge function)
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/delete-auth-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ user_id: u.id }),
          })
        } catch (e: any) {
          console.error('[UsersPage] delete-auth-user failed:', e);
          toast.warning('Database user deleted but auth cleanup failed: ' + e.message);
          results.authFailed++
        }

        // Delete from users table
        const { error } = await supabase.from('users').delete().eq('id', u.id)
        if (error) { userFailed++ } else { userDeleted++ }
      }
      results.users = userDeleted

      // 6. Refresh the list
      await fetchAll()

      // 7. Show detailed results
      const summary = [
        `${results.users} user(s) deleted`,
        results.orders > 0 ? `${results.orders} order(s)` : null,
        results.orderItems > 0 ? `${results.orderItems} order item(s)` : null,
        results.invoices > 0 ? `${results.invoices} invoice(s)` : null,
        results.commissions > 0 ? `${results.commissions} commission(s)` : null,
        results.stores > 0 ? `${results.stores} store(s)` : null,
        results.agreements > 0 ? `${results.agreements} agreement(s)` : null,
        results.transactions > 0 ? `${results.transactions} transaction(s)` : null,
        results.repAssignments > 0 ? `${results.repAssignments} rep assignment(s)` : null,
        results.stateAssignments > 0 ? `${results.stateAssignments} territory assignment(s)` : null,
        results.applications > 0 ? `${results.applications} application(s)` : null,
        results.auditLog > 0 ? `${results.auditLog} audit log(s)` : null,
        results.archivedReset > 0 ? `${results.archivedReset} archive flag(s) reset` : null,
        results.shippingReset > 0 ? `${results.shippingReset} shipping field(s) cleared` : null,
        results.paidReset > 0 ? `${results.paidReset} payment field(s) cleared` : null,
        results.remindersReset > 0 ? `${results.remindersReset} reminder(s) reset` : null,
        results.authFailed > 0 ? `${results.authFailed} auth cleanup(s) skipped` : null,
      ].filter(Boolean).join(', ')

      toast.success(`Database cleaned: ${summary}`)
      setShowDeleteAllDialog(false)
    } catch (err: any) {
      toast.error(err?.message || 'Database cleanup failed')
    }
    setDeletingAll(false)
  }

  // ──── EXPORT ALL USERS TO CSV (snapshot backup) ────
  const handleExportAll = () => {
    if (allAccounts.length === 0) {
      toast.info('No users to export')
      return
    }

    // CSV headers — all user fields + relationship columns
    const headers = [
      'id', 'business_name', 'email', 'phone', 'role', 'status',
      'address', 'city', 'state', 'zip', 'license_number', 'ein', 'website',
      'manager_id', 'manager_email', 'manager_name',
      'territory_states', 'assigned_reps', 'store_count',
      'created_at',
    ]

    // Helper to safely escape CSV values
    const escapeCSV = (val: any) => {
      const str = val == null ? '' : String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Build rows
    const rows = allAccounts.map((account) => {
      // Resolve manager info
      const managerId = account.raw?.manager_id || ''
      const manager = managerId ? allAccounts.find(u => u.id === managerId) : null
      const managerEmail = manager?.email || ''
      const managerName = manager?.business_name || ''

      // Resolve territory states (for managers)
      const territoryStates = account.role === 'sales_manager'
        ? (managerStateMap.get(account.id) || []).join('; ')
        : ''

      // Resolve assigned reps (for business accounts)
      const assignedReps = (account.role === 'wholesaler' || account.role === 'distributor')
        ? allAccounts
            .filter(u => u.role === 'sales_rep' && u.raw?.manager_id === account.id)
            .map(r => r.business_name || r.email)
            .join('; ')
        : ''

      // Store count
      const storeCount = storeCountMap.get(account.id) || 0

      return [
        account.id,
        account.business_name,
        account.email,
        account.phone || '',
        account.role || '',
        account.status,
        account.address || '',
        account.city || '',
        account.state || '',
        account.zip || '',
        account.license_number || '',
        account.ein || '',
        account.website || '',
        managerId,
        managerEmail,
        managerName,
        territoryStates,
        assignedReps,
        storeCount,
        account.raw?.created_at || '',
      ].map(escapeCSV).join(',')
    })

    // Assemble CSV
    const csv = [headers.join(','), ...rows].join('\n')

    // Create download blob
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // Filename with timestamp
    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    link.download = `microDOS2_users_snapshot_${timestamp}.csv`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success(`Exported ${allAccounts.length} user(s) to CSV`)
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
      const { error } = await supabase.from('manager_state_assignments').insert({
        manager_id: managerId,
        state_code: state,
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
      const { error } = await supabase.from('manager_state_assignments').delete()
        .eq('manager_id', managerId).eq('state_code', state)
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

  const accountTypeLabel = () => {
    switch (accountType) {
      case 'wholesaler': return 'Wholesaler'
      case 'distributor': return 'Distributor'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">User Management</h2>
          <p className="text-gray-400">
            {filteredCount} {filterMode === 'employees' ? 'employees' : filterMode === 'business' ? 'business users' : filterMode === 'unassigned' ? 'unassigned' : 'approved users'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setShowAddAccountModal(true)} title="Add a new business account" className="bg-gradient-to-r from-[#ff66c4] to-[#9a02d0] text-white">
            <Store className="w-4 h-4 mr-1" /> Add Business Account
          </Button>
          <Button onClick={() => setShowCreateModal(true)} title="Create a new user account" className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">
            <Plus className="w-4 h-4 mr-1" /> Create User
          </Button>
          <Button
            variant="outline"
            onClick={handleExportAll}
            title="Download all users as CSV"
            className="border-[#44f80c]/30 text-[#44f80c] hover:bg-[#44f80c]/10 hover:text-[#44f80c]"
          >
            <Download className="w-4 h-4 mr-1" /> Download Snapshot
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowDeleteAllDialog(true)}
            title="Delete all non-admin data"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Pre-Launch Cleanup
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
          {(['all', 'employees', 'business', 'unassigned'] as FilterMode[]).map((mode) => (
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
              {mode === 'unassigned' && 'Unassigned'}
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
                      { key: 'website' as SortColumn, label: 'Website', align: 'left' },
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Login</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sorted.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-gray-500 py-8">No approved users found</td></tr>
                  )}
                  {sorted.map((account) => {
                    const role = account.role || ''
                    const displayName = account.business_name

                    return (
                      <tr key={account.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-white font-medium">{displayName}</span>
                          {(['wholesaler', 'distributor'].includes(role) && account.contact_name && account.contact_name !== account.business_name) && (
                            <span className="block text-xs text-gray-400 mt-0.5">Contact: {account.contact_name}</span>
                          )}
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
                        <td className="px-4 py-3 text-gray-400 text-sm max-w-[150px] truncate">
                          {account.website ? (
                            <a href={account.website.startsWith('http') ? account.website : `https://${account.website}`} target="_blank" rel="noopener noreferrer" className="text-[#44f80c] hover:underline truncate" onClick={e => e.stopPropagation()}>
                              {account.website}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatLastLogin(lastLoginMap.get(account.id))}
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
                            <Button size="sm" onClick={() => openEdit(account)} disabled={actionLoading === account.id + '-edit'} title="Edit this account"
                              className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 h-7 px-2">
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(account)} disabled={actionLoading === account.id + '-delete'} title="Delete this account"
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
                  Wholesaler and Distributor accounts must be created via <strong>Add Business Account</strong>.
                </p>
              </div>
            </div>
            <Button onClick={handleCreateUser} disabled={creatingUser} title="Create user and generate password" className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">
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
                {(['wholesaler', 'distributor'] as const).map((t) => (
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
            <Button onClick={handleAddAccount} disabled={addingAccount} title="Create business account" className="w-full bg-gradient-to-r from-[#ff66c4] to-[#9a02d0] text-white">
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
              <Label className="text-gray-300">{(['wholesaler', 'distributor'].includes(editingUser?.role || '')) ? 'Business Name' : 'Full Name'}</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-[#0a0514] border-white/10 text-white" />
            </div>
            {(['wholesaler', 'distributor'].includes(editingUser?.role || '')) && (
              <div>
                <Label className="text-gray-300">Contact Name</Label>
                <Input value={editContactName} onChange={(e) => setEditContactName(e.target.value)} placeholder="Primary contact person" className="bg-[#0a0514] border-white/10 text-white" />
              </div>
            )}
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
            {/* Also Sales Rep toggle for managers */}
            {editingUser && editingUser.role === 'sales_manager' && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-[#9a02d0]/10 to-[#44f80c]/10 border border-[#44f80c]/20">
                <input
                  type="checkbox"
                  id="also-rep-toggle"
                  checked={editAlsoRep}
                  onChange={(e) => setEditAlsoRep(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-[#0a0514] text-[#44f80c] focus:ring-[#44f80c] focus:ring-offset-0 cursor-pointer"
                />
                <div className="flex-1">
                  <Label htmlFor="also-rep-toggle" className="text-[#44f80c] font-medium cursor-pointer">
                    Also a Sales Rep
                  </Label>
                  <p className="text-xs text-gray-400">
                    Enables dual-role access — manager can log into rep functions and earn commissions on their own accounts
                  </p>
                </div>
                {editAlsoRep && (
                  <span className="px-2 py-0.5 rounded-full bg-[#44f80c]/20 text-[#44f80c] text-[10px] font-medium">
                    Dual Role
                  </span>
                )}
              </div>
            )}
            {/* Sales Rep assignment for business accounts */}
            {editingUser && ['wholesaler', 'distributor'].includes(editingUser.role || '') && (
              <div>
                <Label className="text-gray-300">Sales Rep</Label>
                <Select value={editRepId || 'none'} onValueChange={setEditRepId}>
                  <SelectTrigger className="bg-[#0a0514] border-white/10 text-white"><SelectValue placeholder="— No Rep —" /></SelectTrigger>
                  <SelectContent className="bg-[#150f24] border-white/10">
                    <SelectItem value="none">— No Rep —</SelectItem>
                    {allAccounts.filter(u => u.role === 'sales_rep').map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.business_name || r.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editRepId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Manager: {allAccounts.find(u => u.id === allAccounts.find(r => r.id === editRepId)?.raw?.manager_id)?.business_name || 'None'}
                  </p>
                )}
              </div>
            )}
            {/* Sales Manager for reps */}
            {editingUser && editingUser.role === 'sales_rep' && (
              <div>
                <Label className="text-gray-300">Sales Manager</Label>
                <Select value={editManagerId || 'none'} onValueChange={setEditManagerId}>
                  <SelectTrigger className="bg-[#0a0514] border-white/10 text-white"><SelectValue placeholder="— No Manager —" /></SelectTrigger>
                  <SelectContent className="bg-[#150f24] border-white/10">
                    <SelectItem value="none">— No Manager —</SelectItem>
                    {allAccounts.filter(u => u.role === 'sales_manager').map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.business_name || m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editingUser && ['sales_rep', 'sales_manager', 'admin', 'shipping_fulfillment'].includes(editingUser.role || '') && (
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
            <Button onClick={handleSaveEdit} disabled={savingEdit} title="Save changes to user" className="w-full bg-gradient-to-r from-blue-500 to-[#9a02d0] text-white">
              {savingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Non-Admin Users Confirmation Dialog */}
      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent className="bg-[#150f24] border border-red-500/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Full Database Cleanup
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Pre-launch wipe — removes ALL non-admin data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-2">
              <p className="text-sm text-red-300 font-semibold">
                <strong>Warning:</strong> This will delete {allAccounts.filter(u => u.role !== 'admin' && u.source === 'users').length} non-admin user(s) AND all their data:
              </p>
              <ul className="text-xs text-red-300/80 list-disc list-inside space-y-0.5">
                <li><strong>ALL orders</strong> (admin + non-admin test orders)</li>
                <li><strong>ALL invoices</strong></li>
                <li><strong>ALL commission payments</strong></li>
                <li>All order items</li>
                <li>All store locations</li>
                <li>All agreements</li>
                <li>All payment transactions</li>
                <li>All signup applications</li>
                <li>All audit logs</li>
                <li>Manager territory assignments</li>
                <li>Rep account assignments</li>
                <li>All archive flags reset</li>
                <li>All shipping/tracking data cleared</li>
                <li>All payment fields cleared</li>
                <li>All overdue reminders reset</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-white/10 text-gray-300 hover:bg-white/5"
                onClick={() => setShowDeleteAllDialog(false)}
                title="Cancel cleanup"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDeleteAllNonAdmin}
                disabled={deletingAll}
                title="Permanently delete all non-admin data"
              >
                {deletingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {deletingAll ? 'Deleting...' : 'Delete All'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ EMAIL SENT CONFIRMATION MODAL ═══ */}
      <Dialog open={showEmailSentModal} onOpenChange={setShowEmailSentModal}>
        <DialogContent className="bg-[#150f24] border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#44f80c]" /> Account Created
            </DialogTitle>
            <DialogDescription className="text-gray-400">Welcome email sent automatically</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-[#0a0514] p-4 rounded-lg border border-white/10">
              <Label className="text-gray-400 text-sm mb-2 block">Email Sent To</Label>
              <p className="text-white font-mono text-sm">{sentEmailTo}</p>
            </div>
            <p className="text-gray-400 text-sm">The user has received an email with their login credentials and will be prompted to change their password on first login.</p>
            <Button onClick={() => setShowEmailSentModal(false)} title="Close" className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
