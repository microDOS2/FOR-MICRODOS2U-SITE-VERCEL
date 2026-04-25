import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowRightLeft,
  Shield,
  Users,
  Store,
  Check,
  AlertTriangle,
  Loader2,
  Building2,
  MapPin,
  ClipboardCheck,
  ArrowRight,
  UserCheck,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface Manager {
  id: string
  business_name: string | null
  email: string
  states: string[]
}

interface Account {
  id: string
  business_name: string
  email: string
  role: string
  city: string | null
  state: string | null
  referral_code: string
  manager_id: string | null
  assigned_rep_id: string | null
  assigned_rep_name: string | null
  stores: { id: string; name: string; city: string; state: string }[]
}

export function TerritoryTransferPage() {
  const [managers, setManagers] = useState<Manager[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [transferring, setTransferring] = useState(false)

  // Wizard state
  const [sourceManagerId, setSourceManagerId] = useState<string>('')
  const [targetManagerId, setTargetManagerId] = useState<string>('')
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [moveRepFlags, setMoveRepFlags] = useState<Record<string, boolean>>({})
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: mgrData }, { data: acctData }, { data: repData }, { data: storesData }, { data: assignmentsData }] = await Promise.all([
      supabase.from('users').select('id, business_name, email').eq('role', 'sales_manager').eq('status', 'approved').order('business_name', { ascending: true }),
      supabase.from('users').select('id, business_name, email, role, city, state, referral_code, manager_id').eq('status', 'approved').in('role', ['wholesaler', 'distributor']).order('business_name', { ascending: true }),
      supabase.from('users').select('id, business_name, email, manager_id').eq('role', 'sales_rep').eq('status', 'approved').order('business_name', { ascending: true }),
      supabase.from('wholesaler_store_locations').select('id, name, city, state, user_id').order('name', { ascending: true }),
      supabase.from('rep_account_assignments').select('account_id, rep_id'),
    ])

    const { data: statesData } = await supabase.from('manager_state_assignments').select('manager_id, state_code')
    const statesByMgr = new Map<string, string[]>()
    ;(statesData || []).forEach((s: any) => {
      const list = statesByMgr.get(s.manager_id) || []
      list.push(s.state_code)
      statesByMgr.set(s.manager_id, list)
    })

    const mgrList: Manager[] = (mgrData || []).map((m: any) => ({
      id: m.id,
      business_name: m.business_name,
      email: m.email,
      states: statesByMgr.get(m.id) || [],
    }))

    const repMap = new Map<string, { id: string; business_name: string | null; email: string; manager_id: string | null }>()
    ;(repData || []).forEach((r: any) => repMap.set(r.id, r))

    const assignmentMap = new Map<string, string>()
    ;(assignmentsData || []).forEach((a: any) => assignmentMap.set(a.account_id, a.rep_id))

    const storesByUser = new Map<string, { id: string; name: string; city: string; state: string }[]>()
    ;(storesData || []).forEach((s: any) => {
      const list = storesByUser.get(s.user_id) || []
      const sn = (s.name || '').replace(/^\d+[a-z]\s*-\s*/, '')
      list.push({ id: s.id, name: sn || s.name, city: s.city || '', state: s.state || '' })
      storesByUser.set(s.user_id, list)
    })

    const acctList: Account[] = (acctData || []).map((u: any) => {
      const repId = assignmentMap.get(u.id)
      const rep = repId ? repMap.get(repId) : null
      return {
        id: u.id,
        business_name: u.business_name,
        email: u.email,
        role: u.role,
        city: u.city,
        state: u.state,
        referral_code: u.referral_code || '',
        manager_id: u.manager_id || null,
        assigned_rep_id: repId || null,
        assigned_rep_name: rep ? (rep.business_name || rep.email) : null,
        stores: storesByUser.get(u.id) || [],
      }
    })

    setManagers(mgrList)
    setAccounts(acctList)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Reset selection when source changes
  useEffect(() => {
    setSelectedAccounts(new Set())
    setMoveRepFlags({})
    setTargetManagerId('')
  }, [sourceManagerId])

  const sourceAccounts = accounts.filter(a => a.manager_id === sourceManagerId)

  const toggleAccount = (acctId: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev)
      if (next.has(acctId)) {
        next.delete(acctId)
        setMoveRepFlags(flags => {
          const f = { ...flags }
          delete f[acctId]
          return f
        })
      } else {
        next.add(acctId)
        // DEFAULT: rep STAYS (moveRep = false)
        const acct = accounts.find(a => a.id === acctId)
        if (acct?.assigned_rep_id) {
          setMoveRepFlags(flags => ({ ...flags, [acctId]: false }))
        }
      }
      return next
    })
  }

  const toggleMoveRep = (acctId: string) => {
    setMoveRepFlags(prev => ({ ...prev, [acctId]: !prev[acctId] }))
  }

  const selectedCount = selectedAccounts.size
  const moveRepCount = Array.from(selectedAccounts).filter(id => moveRepFlags[id]).length
  const stayRepCount = selectedCount - moveRepCount

  const handleTransfer = () => {
    if (!sourceManagerId || !targetManagerId || selectedCount === 0) {
      toast.error('Select source manager, target manager, and at least one account')
      return
    }
    setShowConfirmModal(true)
  }

  const executeTransfer = async () => {
    setShowConfirmModal(false)
    setTransferring(true)

    const transfers = Array.from(selectedAccounts).map(id => {
      const acct = accounts.find(a => a.id === id)
      return {
        account_id: id,
        rep_id: acct?.assigned_rep_id && moveRepFlags[id] ? acct.assigned_rep_id : null,
      }
    })

    const { data, error } = await supabase.rpc('transfer_accounts_batch_json', {
      p_source_manager_id: sourceManagerId,
      p_target_manager_id: targetManagerId,
      p_transfers: transfers,
    })

    if (error) {
      console.error('transfer_accounts_batch_json error:', error)
      toast.error('Transfer failed: ' + error.message)
    } else {
      toast.success(
        `Transfer complete! ${data?.moved_accounts || selectedCount} accounts moved, ${data?.moved_reps || moveRepCount} reps moved, ${data?.transfer_count || moveRepCount} new transfer queue entries.`,
        { duration: 6000 }
      )
      setSelectedAccounts(new Set())
      setMoveRepFlags({})
      setSourceManagerId('')
      setTargetManagerId('')
      await fetchData()
    }
    setTransferring(false)
  }

  const roleBadge: Record<string, string> = {
    wholesaler: 'bg-[#44f80c]/20 text-[#44f80c]',
    distributor: 'bg-[#ff66c4]/20 text-[#ff66c4]',
  }

  const sourceManager = managers.find(m => m.id === sourceManagerId)
  const targetManager = managers.find(m => m.id === targetManagerId)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
          <ArrowRightLeft className="w-6 h-6 text-[#9a02d0]" />
          Territory Transfer
        </h2>
        <p className="text-gray-400">Move business accounts from one sales manager to another. By default, reps stay with the account under their current manager.</p>
      </div>

      {/* Step 1: Source Manager */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#9a02d0]" />
            Step 1: Source Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={sourceManagerId}
            onChange={(e) => setSourceManagerId(e.target.value)}
            className="w-full max-w-md bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
          >
            <option value="">— Select a Manager —</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>
                {m.business_name || m.email} {m.states.length > 0 ? `(${m.states.join(', ')})` : ''}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Step 2: Select Accounts */}
      {sourceManagerId && (
        <Card className="bg-[#150f24] border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#44f80c]" />
              Step 2: Select Accounts to Transfer
              <Badge className="bg-[#9a02d0]/20 text-[#9a02d0] text-xs ml-2">{sourceAccounts.length} accounts</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" /></div>
            ) : sourceAccounts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Store className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                <p className="text-gray-400">No accounts found for this manager</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 mb-3 pb-2 border-b border-white/10">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const allIds = sourceAccounts.map(a => a.id)
                      const allSelected = allIds.every(id => selectedAccounts.has(id))
                      if (allSelected) {
                        setSelectedAccounts(new Set())
                        setMoveRepFlags({})
                      } else {
                        setSelectedAccounts(new Set(allIds))
                        const flags: Record<string, boolean> = {}
                        sourceAccounts.forEach(a => {
                          if (a.assigned_rep_id) flags[a.id] = false // default: rep STAYS
                        })
                        setMoveRepFlags(flags)
                      }
                    }}
                    className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5 text-xs h-7"
                  >
                    {sourceAccounts.every(a => selectedAccounts.has(a.id)) ? 'Deselect All' : 'Select All'}
                  </Button>
                  <span className="text-sm text-gray-400">{selectedCount} selected</span>
                </div>
                {sourceAccounts.map(acct => {
                  const isSelected = selectedAccounts.has(acct.id)
                  const hasRep = !!acct.assigned_rep_id
                  const moveRep = !!moveRepFlags[acct.id]
                  return (
                    <div
                      key={acct.id}
                      onClick={() => toggleAccount(acct.id)}
                      className={cn(
                        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                        isSelected
                          ? 'bg-[#9a02d0]/10 border-[#9a02d0]/40'
                          : 'bg-[#0a0514] border-white/10 hover:border-white/20'
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          isSelected ? 'bg-[#44f80c] border-[#44f80c]' : 'border-gray-500'
                        )}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#0a0514]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono bg-[#9a02d0]/20 text-[#9a02d0] px-2 py-0.5 rounded">#{acct.referral_code}</span>
                            <span className="text-white font-medium text-sm">{acct.business_name}</span>
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full uppercase', roleBadge[acct.role] || 'bg-gray-500/20')}>
                              {acct.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span>{acct.city || '—'}, {acct.state || '—'}</span>
                            {acct.stores.length > 0 && (
                              <span>• {acct.stores.length} store{acct.stores.length !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                          {hasRep && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <Users className="w-3 h-3 text-[#44f80c]" />
                              <span className="text-xs text-[#44f80c]">Rep: {acct.assigned_rep_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && hasRep && (
                        <div
                          className="flex items-center gap-2 flex-shrink-0 ml-8 sm:ml-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none bg-[#0a0514] px-2.5 py-1.5 rounded-lg border border-white/10">
                            <input
                              type="checkbox"
                              checked={moveRep}
                              onChange={() => toggleMoveRep(acct.id)}
                              className="w-4 h-4 rounded border-gray-500 accent-[#ff66c4]"
                            />
                            <span className={moveRep ? 'text-[#ff66c4] font-medium' : 'text-gray-400'}>
                              Move rep to new manager
                            </span>
                          </label>
                          {!moveRep ? (
                            <Badge className="bg-[#44f80c]/10 text-[#44f80c] text-[10px] border-[#44f80c]/20">
                              <UserCheck className="w-3 h-3 mr-1" /> Rep stays
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500/10 text-yellow-400 text-[10px] border-yellow-400/20">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Rep moves
                            </Badge>
                          )}
                        </div>
                      )}
                      {isSelected && !hasRep && (
                        <div className="ml-8 sm:ml-0">
                          <Badge className="bg-gray-700/50 text-gray-400 text-[10px]">No rep assigned</Badge>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Target Manager */}
      {selectedCount > 0 && (
        <Card className="bg-[#150f24] border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#ff66c4]" />
              Step 3: Target Manager
            </CardTitle>
          </CardHeader>
          <CardContent>
            <select
              value={targetManagerId}
              onChange={(e) => setTargetManagerId(e.target.value)}
              className="w-full max-w-md bg-[#0a0514] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
            >
              <option value="">— Select Target Manager —</option>
              {managers.filter(m => m.id !== sourceManagerId).map(m => (
                <option key={m.id} value={m.id}>
                  {m.business_name || m.email} {m.states.length > 0 ? `(${m.states.join(', ')})` : ''}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Confirm */}
      {targetManagerId && selectedCount > 0 && (
        <Card className="bg-[#150f24] border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#44f80c]" />
              Step 4: Review & Confirm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#0a0514] rounded-lg p-3 border border-white/10 text-center">
                <p className="text-2xl font-bold text-white">{selectedCount}</p>
                <p className="text-xs text-gray-400">Accounts moving</p>
              </div>
              <div className="bg-[#0a0514] rounded-lg p-3 border border-[#44f80c]/20 text-center">
                <p className="text-2xl font-bold text-[#44f80c]">{stayRepCount}</p>
                <p className="text-xs text-gray-400">Reps staying</p>
              </div>
              <div className="bg-[#0a0514] rounded-lg p-3 border border-yellow-400/20 text-center">
                <p className="text-2xl font-bold text-yellow-400">{moveRepCount}</p>
                <p className="text-xs text-gray-400">Reps moving</p>
              </div>
              <div className="bg-[#0a0514] rounded-lg p-3 border border-white/10 text-center">
                <p className="text-2xl font-bold text-[#ff66c4]">{moveRepCount}</p>
                <p className="text-xs text-gray-400">Transfer queue entries</p>
              </div>
            </div>

            <Button
              onClick={handleTransfer}
              className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold py-3 h-auto"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Review Transfer Details
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#150f24] border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#9a02d0]/20">
                  <ClipboardCheck className="w-6 h-6 text-[#9a02d0]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Confirm Territory Transfer</h3>
                  <p className="text-xs text-gray-400">
                    {sourceManager?.business_name || sourceManager?.email} → {targetManager?.business_name || targetManager?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Manager flow */}
              <div className="flex items-center gap-3 bg-[#0a0514] rounded-lg p-4 border border-white/10">
                <div className="flex-1 text-center">
                  <p className="text-sm font-medium text-white">{sourceManager?.business_name || 'Source'}</p>
                  <p className="text-xs text-gray-500">Current Manager</p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#9a02d0]" />
                <div className="flex-1 text-center">
                  <p className="text-sm font-medium text-white">{targetManager?.business_name || 'Target'}</p>
                  <p className="text-xs text-gray-500">New Manager</p>
                </div>
              </div>

              {/* Account list */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Accounts to Transfer ({selectedCount})
                </h4>
                {Array.from(selectedAccounts).map(id => {
                  const acct = accounts.find(a => a.id === id)
                  if (!acct) return null
                  const repMoves = !!moveRepFlags[id]
                  return (
                    <div key={id} className="bg-[#0a0514] rounded-lg p-4 border border-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono bg-[#9a02d0]/20 text-[#9a02d0] px-2 py-0.5 rounded">#{acct.referral_code}</span>
                            <span className="text-white font-medium text-sm">{acct.business_name}</span>
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full uppercase', roleBadge[acct.role] || 'bg-gray-500/20')}>
                              {acct.role}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {acct.city || '—'}, {acct.state || '—'} • {acct.stores.length} store{acct.stores.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Rep decision */}
                      {acct.assigned_rep_id && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <div className="flex items-center gap-3">
                            <Users className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-300">
                              Rep: <span className="text-white font-medium">{acct.assigned_rep_name}</span>
                            </span>
                            {repMoves ? (
                              <div className="flex items-center gap-1.5 ml-auto">
                                <ArrowRight className="w-3 h-3 text-yellow-400" />
                                <Badge className="bg-yellow-500/10 text-yellow-400 text-[10px] border-yellow-400/20">
                                  <AlertTriangle className="w-3 h-3 mr-1" /> Moves to new manager
                                </Badge>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 ml-auto">
                                <UserCheck className="w-3 h-3 text-[#44f80c]" />
                                <Badge className="bg-[#44f80c]/10 text-[#44f80c] text-[10px] border-[#44f80c]/20">
                                  Stays with account
                                </Badge>
                              </div>
                            )}
                          </div>
                          {repMoves && (
                            <p className="text-xs text-yellow-400/70 mt-1 ml-7">
                              A transfer queue entry will be created for the new manager to accept.
                            </p>
                          )}
                        </div>
                      )}
                      {!acct.assigned_rep_id && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <Badge className="bg-gray-700/50 text-gray-400 text-[10px]">No rep assigned</Badge>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Summary footer */}
              <div className="bg-[#0a0514] rounded-lg p-4 border border-white/10">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-white">{selectedCount}</p>
                    <p className="text-xs text-gray-400">Accounts</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#44f80c]">{stayRepCount}</p>
                    <p className="text-xs text-gray-400">Reps Stay</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-yellow-400">{moveRepCount}</p>
                    <p className="text-xs text-gray-400">Reps Move</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center gap-3 p-6 border-t border-white/10">
              <Button
                onClick={() => setShowConfirmModal(false)}
                variant="outline"
                className="flex-1 border-white/10 text-gray-300 hover:text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={executeTransfer}
                disabled={transferring}
                className="flex-1 bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold"
              >
                {transferring ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Confirm Transfer</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
