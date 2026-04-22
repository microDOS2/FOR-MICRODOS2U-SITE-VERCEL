import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Users, Plus, Search, Check, Copy, Store, UserPlus, Loader2, X, Info, Pencil, Eye
} from 'lucide-react'
import { toast } from 'sonner'
import type { DBUser } from '@/lib/supabase'

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
  retailer: 'Retailer',
}

const roleBadgeClasses: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-500',
  sales_manager: 'bg-purple-500/20 text-purple-500',
  sales_rep: 'bg-blue-500/20 text-blue-500',
  wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
  distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
  influencer: 'bg-orange-500/20 text-orange-500',
  retailer: 'bg-gray-500/20 text-gray-400',
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
  const navigate = useNavigate()
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
  const [savingEdit, setSavingEdit] = useState(false)

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [copied, setCopied] = useState(false)

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Manager assignment loading
  const [savingManager, setSavingManager] = useState<string | null>(null)

  // ─── Fetch both users AND pending applications ───
  const fetchAll = async () => {
    setLoading(true)
    try {
      // 1. Fetch approved users via RPC (bypasses RLS for admin)
      const { data: usersData, error: usersError } = await supabase
        .rpc('get_all_users')

      // 2. Fetch pending applications
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select('*')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })

      if (usersError) console.error('Users error:', usersError)
      if (appsError) console.error('Apps error:', appsError)

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

      // Add pending applications
      ;(appsData || []).forEach((a: any) => {
        combined.push({
          id: a.id,
          source: 'applications',
          business_name: a.business_name || a.email,
          contact_name: a.contact_name,
          email: a.email,
          phone: a.phone,
          account_type: a.account_type,
          role: a.account_type,
          status: 'pending',
          city: a.city,
          state: a.state,
          zip: a.zip,
          license_number: a.license_number,
          ein: a.ein,
          website: a.website,
          address: a.address,
          raw: a,
        })
      })

      setAllAccounts(combined)
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
    return (
      a.business_name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.role || '').toLowerCase().includes(q) ||
      a.status.toLowerCase().includes(q)
    )
  })

  const approvedCount = allAccounts.filter((a) => a.status === 'approved').length
  const pendingCount = allAccounts.filter((a) => a.status === 'pending').length

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
      await supabase.from('users').insert({
        id: authData.user.id,
        email: newUserEmail,
        business_name: newUserName,
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
      if (error) {
        toast.error('Failed to update: ' + error.message)
      } else {
        toast.success('User updated!')
        setShowEditModal(false)
        await fetchAll()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error')
    }
    setSavingEdit(false)
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
      toast.success('Deleted')
      await fetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed')
    }
    setActionLoading(null)
  }

  // ──── ASSIGN MANAGER TO ACCOUNT ────
  const handleAssignManager = async (accountId: string, managerId: string) => {
    setSavingManager(accountId)
    try {
      const { error } = await supabase
        .from('users')
        .update({ manager_id: managerId || null })
        .eq('id', accountId)
      if (error) throw error
      toast.success(managerId ? 'Manager assigned!' : 'Manager removed!')
      await fetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update')
    }
    setSavingManager(null)
  }

  // ──── APPROVE APPLICATION ────
  const handleApproveFromUsers = async (_app: UnifiedUser) => {
    navigate('/admin/applications')
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
            {approvedCount} approved • {pendingCount} pending
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          type="text"
          placeholder="Search by name, email, role, or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#0a0514] border-white/10 text-white"
        />
      </div>

      {/* ─── UNIFIED TABLE: Approved + Pending ─── */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#9a02d0]" />
            All Accounts ({filtered.length})
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Manager</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Location</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-gray-500 py-8">No accounts found</td></tr>
                  )}
                  {filtered.map((account) => {
                    const role = account.role || account.account_type || ''
                    const displayName = account.source === 'applications'
                      ? (account.contact_name ? `${account.contact_name} — ${account.business_name}` : account.business_name)
                      : account.business_name

                    return (
                      <tr key={`${account.source}-${account.id}`} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-white font-medium">{displayName}</span>
                          {account.source === 'applications' && (
                            <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 text-[10px]">APPLICATION</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">{account.email}</td>
                        <td className="px-4 py-3">
                          <Badge className={roleBadgeClasses[role] || 'bg-gray-500/20 text-gray-400'}>
                            {roleLabels[role] || role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={
                            account.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                            account.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                            'bg-red-500/20 text-red-500'
                          }>
                            {account.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {account.role === 'sales_manager' && account.source === 'users' ? (
                            (() => { try { const p = account.raw?.volume_estimate ? JSON.parse(account.raw.volume_estimate) : []; return Array.isArray(p) && p.length > 0 ? <div className="flex flex-wrap gap-1">{p.map((s: string) => <span key={s} className="text-xs bg-[#44f80c]/20 text-[#44f80c] px-2 py-0.5 rounded">{s}</span>)}</div> : <span className="text-xs text-gray-500">No states</span> } catch { return <span className="text-xs text-gray-500">No states</span> } })()
                          ) : (account.role === 'wholesaler' || account.role === 'distributor') && account.source === 'users' ? (
                            <select
                              className="text-xs bg-[#0a0514] border border-white/10 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-[#44f80c]/50 w-full max-w-[140px]"
                              value={account.raw?.manager_id || ''}
                              onChange={(e) => handleAssignManager(account.id, e.target.value)}
                              disabled={savingManager === account.id}
                            >
                              <option value="">— No Manager —</option>
                              {(() => { const sm = allAccounts.filter(u => u.role === 'sales_manager' && u.status === 'approved'); return sm.map(m => <option key={m.id} value={m.id}>{m.business_name}</option>) })()}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm">
                          {account.city && account.state ? `${account.city}, ${account.state}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {account.source === 'users' ? (
                              <>
                                <Button size="sm" onClick={() => openEdit(account)} disabled={actionLoading === account.id + '-edit'}
                                  className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 h-7 px-2">
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDelete(account)} disabled={actionLoading === account.id + '-delete'}
                                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 px-2">
                                  <X className="w-3 h-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" onClick={() => handleApproveFromUsers(account)} disabled={actionLoading === account.id + '-review'}
                                  className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 h-7 px-2" title="Review Application">
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDelete(account)} disabled={actionLoading === account.id + '-delete'}
                                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 px-2">
                                  <X className="w-3 h-3" />
                                </Button>
                              </>
                            )}
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
              <Label className="text-gray-300">Business / Full Name</Label>
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
