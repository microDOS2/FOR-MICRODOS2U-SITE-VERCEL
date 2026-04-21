import { useEffect, useState } from 'react'
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
  Users, Plus, Search, Check, Copy, Store, UserPlus, Loader2, X
} from 'lucide-react'
import { toast } from 'sonner'
import type { DBUser } from '@/lib/supabase'

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
  const [dbUsers, setDbUsers] = useState<DBUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Create user modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)

  // Add account modal state
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

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [copied, setCopied] = useState(false)

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    if (error) {
      toast.error('Failed to fetch users: ' + error.message)
    } else {
      setDbUsers((data || []) as DBUser[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = dbUsers.filter(
    (u) =>
      (u.business_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserRole) {
      toast.error('Please fill in all fields')
      return
    }
    setCreatingUser(true)
    const password = generatePassword()
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password,
        options: { data: { business_name: newUserName } },
      })
      if (authError || !authData.user) {
        toast.error(authError?.message || 'Failed to create user')
        setCreatingUser(false)
        return
      }
      const { error: dbError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: newUserEmail,
        business_name: newUserName,
        role: newUserRole,
        status: 'approved',
      })
      if (dbError) {
        toast.error('Failed to create profile: ' + dbError.message)
        setCreatingUser(false)
        return
      }
      await fetchUsers()
      setGeneratedPassword(password)
      setShowCreateModal(false)
      setShowPasswordModal(true)
      toast.success('User created successfully!')
      setNewUserName('')
      setNewUserEmail('')
      setNewUserRole('')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create user')
    }
    setCreatingUser(false)
  }

  const handleAddAccount = async () => {
    if (!accountBusinessName || !accountContactName || !accountEmail || !accountPassword || !accountLicense) {
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
      const { error: dbError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: accountEmail,
        business_name: accountBusinessName,
        license_number: accountLicense,
        ein: accountEin || null,
        phone: accountPhone || null,
        address: accountAddress || null,
        city: accountCity || null,
        state: accountState || null,
        zip: accountZip || null,
        role: accountType,
        status: 'approved',
      })
      if (dbError) {
        toast.error('Failed to create profile: ' + dbError.message)
        setAddingAccount(false)
        return
      }
      await fetchUsers()
      toast.success(`${accountType === 'wholesaler' ? 'Wholesaler' : 'Distributor'} account created!`)
      setShowAddAccountModal(false)
      setGeneratedPassword(accountPassword)
      setShowPasswordModal(true)
      // Reset form
      setAccountBusinessName(''); setAccountContactName(''); setAccountEmail('')
      setAccountPassword(''); setAccountPhone(''); setAccountAddress('')
      setAccountCity(''); setAccountState(''); setAccountZip('')
      setAccountLicense(''); setAccountEin('')
    } catch (err: any) {
      toast.error(err?.message || 'An unexpected error occurred')
    }
    setAddingAccount(false)
  }

  const handleApprove = async (userId: string) => {
    setActionLoading(userId + '-approve')
    const { error } = await supabase.from('users').update({ status: 'approved' }).eq('id', userId)
    if (error) toast.error('Failed: ' + error.message)
    else { toast.success('Approved'); await fetchUsers() }
    setActionLoading(null)
  }

  const handleReject = async (userId: string) => {
    setActionLoading(userId + '-reject')
    const { error } = await supabase.from('users').update({ status: 'rejected' }).eq('id', userId)
    if (error) toast.error('Failed: ' + error.message)
    else { toast.success('Rejected'); await fetchUsers() }
    setActionLoading(null)
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure?')) return
    setActionLoading(userId + '-delete')
    const { error } = await supabase.from('users').delete().eq('id', userId)
    if (error) toast.error('Failed: ' + error.message)
    else { toast.success('Deleted'); await fetchUsers() }
    setActionLoading(null)
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Password copied')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">User Management</h2>
          <p className="text-gray-400">Manage accounts and create new users</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddAccountModal(true)} className="bg-gradient-to-r from-[#ff66c4] to-[#9a02d0] text-white">
            <Store className="w-4 h-4 mr-1" /> Add Account
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
          placeholder="Search by name, email, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#0a0514] border-white/10 text-white"
        />
      </div>

      {/* Users Table */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#9a02d0]" />
            Users ({filteredUsers.length})
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Location</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-gray-500 py-8">No users found</td></tr>
                  )}
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{user.business_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge className={roleBadgeClasses[user.role] || 'bg-gray-500/20 text-gray-400'}>
                          {roleLabels[user.role] || user.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={
                          user.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                          user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                          'bg-red-500/20 text-red-500'
                        }>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {user.city && user.state ? `${user.city}, ${user.state}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.status === 'pending' && (
                            <>
                              <Button size="sm" onClick={() => handleApprove(user.id)} disabled={actionLoading === user.id + '-approve'}
                                className="bg-green-500/20 text-green-500 hover:bg-green-500/30 h-7 px-2">
                                {actionLoading === user.id + '-approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleReject(user.id)} disabled={actionLoading === user.id + '-reject'}
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 px-2">
                                {actionLoading === user.id + '-reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleDelete(user.id)} disabled={actionLoading === user.id + '-delete'}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 px-2">
                            {actionLoading === user.id + '-delete' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#150f24] border border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#9a02d0]" />
              Create New User
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Create a new account for a sales team member
            </DialogDescription>
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
                <SelectTrigger className="bg-[#0a0514] border-white/10 text-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-[#150f24] border-white/10">
                  <SelectItem value="sales_manager">Sales Manager</SelectItem>
                  <SelectItem value="sales_rep">Sales Rep</SelectItem>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="distributor">Distributor</SelectItem>
                  <SelectItem value="influencer">Influencer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateUser} disabled={creatingUser} className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white">
              {creatingUser ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create User & Generate Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Account Modal */}
      <Dialog open={showAddAccountModal} onOpenChange={setShowAddAccountModal}>
        <DialogContent className="bg-[#150f24] border border-white/10 text-white max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-[#ff66c4]" />
              Add Business Account
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Create a new wholesaler or distributor account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Account Type <span className="text-red-400">*</span></Label>
              <div className="flex gap-4 mt-1">
                <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${accountType === 'wholesaler' ? 'border-[#44f80c] bg-[#44f80c]/10' : 'border-white/10 hover:border-white/30'}`}>
                  <input type="radio" name="acct_type" value="wholesaler" checked={accountType === 'wholesaler'} onChange={() => setAccountType('wholesaler')} className="w-4 h-4 accent-[#44f80c]" />
                  <span className="text-white">Wholesaler</span>
                </label>
                <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${accountType === 'distributor' ? 'border-[#9a02d0] bg-[#9a02d0]/10' : 'border-white/10 hover:border-white/30'}`}>
                  <input type="radio" name="acct_type" value="distributor" checked={accountType === 'distributor'} onChange={() => setAccountType('distributor')} className="w-4 h-4 accent-[#9a02d0]" />
                  <span className="text-white">Distributor</span>
                </label>
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
                <Label className="text-gray-300">License Number <span className="text-red-400">*</span></Label>
                <Input value={accountLicense} onChange={(e) => setAccountLicense(e.target.value)} placeholder="CA-PSY-001" className="bg-[#0a0514] border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-gray-300">EIN</Label>
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
              Create {accountType === 'wholesaler' ? 'Wholesaler' : 'Distributor'} Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Display Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="bg-[#150f24] border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#44f80c]" />
              Account Created
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Copy and securely share these credentials
            </DialogDescription>
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
