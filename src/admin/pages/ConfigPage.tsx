import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { Search, Plus, Pencil, Trash2, X, Save, Settings, Users, Store, ToggleLeft, ToggleRight, CreditCard, Link, Server, Key } from 'lucide-react'

interface ConfigItem {
  id: string
  key: string
  value: string
  description: string | null
  updated_at: string
}

export function ConfigPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null)
  const [formData, setFormData] = useState({ key: '', value: '', description: '' })

  // Influencer apps toggle state (from old admin)
  const [influencerAppsEnabled, setInfluencerAppsEnabled] = useState(false)
  const [appConfigLoading, setAppConfigLoading] = useState(false)

  useEffect(() => { fetchConfigs(); fetchAppConfig() }, [search])

  const fetchConfigs = async () => {
    setLoading(true)
    let query = supabase.from('app_config').select('*').order('key', { ascending: true })
    if (search) query = query.or(`key.ilike.%${search}%,description.ilike.%${search}%`)
    const { data, error } = await query
    if (error) console.error(error)
    else setConfigs(data || [])
    setLoading(false)
  }

  const fetchAppConfig = async () => {
    try {
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'application_config').single()
      if (data?.value?.influencer_applications_enabled === true) {
        setInfluencerAppsEnabled(true)
      }
    } catch {
      // Default disabled
    }
  }

  const toggleInfluencerApps = async () => {
    setAppConfigLoading(true)
    const newValue = !influencerAppsEnabled
    try {
      const { error } = await supabase.from('site_settings').upsert(
        { key: 'application_config', value: { influencer_applications_enabled: newValue }, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      if (error) {
        alert('Failed to update: ' + error.message)
      } else {
        setInfluencerAppsEnabled(newValue)
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update')
    }
    setAppConfigLoading(false)
  }

  const handleSave = async () => {
    if (!formData.key.trim()) { alert('Key is required'); return }
    if (editingConfig) {
      const { error } = await supabase.from('app_config').update({
        key: formData.key, value: formData.value, description: formData.description, updated_at: new Date().toISOString()
      }).eq('id', editingConfig.id)
      if (error) alert('Error: ' + error.message)
    } else {
      const { error } = await supabase.from('app_config').insert([{ key: formData.key, value: formData.value, description: formData.description }])
      if (error) alert('Error: ' + error.message)
    }
    setShowModal(false); setEditingConfig(null); setFormData({ key: '', value: '', description: '' }); fetchConfigs()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this config?')) return
    const { error } = await supabase.from('app_config').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchConfigs()
  }

  const openEdit = (c: ConfigItem) => {
    setEditingConfig(c)
    setFormData({ key: c.key, value: c.value, description: c.description || '' })
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Configuration</h2>
        <p className="text-gray-400">Manage application settings and feature toggles</p>
      </div>

      {/* Influencer Applications Toggle — from old admin */}
      <Card className="bg-[#150f24] border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#ff66c4]/20 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-[#ff66c4]" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Influencer Applications</h3>
                <p className="text-gray-400 text-sm mt-1">
                  When enabled, applicants can select &quot;Influencer&quot; as an account type on the
                  wholesale application form. When disabled, only Wholesaler and Distributor
                  options are shown.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge className={influencerAppsEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-500'}>
                    {influencerAppsEnabled ? 'ENABLED' : 'DISABLED'}
                  </Badge>
                  <span className="text-gray-500 text-xs">
                    {influencerAppsEnabled ? 'Influencer option visible on application form' : 'Influencer option hidden from application form'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={toggleInfluencerApps} disabled={appConfigLoading} className="shrink-0 ml-4">
              {appConfigLoading ? (
                <div className="w-14 h-8 bg-gray-700 rounded-full animate-pulse" />
              ) : influencerAppsEnabled ? (
                <ToggleRight className="w-14 h-8 text-[#44f80c]" />
              ) : (
                <ToggleLeft className="w-14 h-8 text-gray-600" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Application Types Summary */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#9a02d0]" />
            Current Configuration Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <Store className="w-5 h-5 text-[#44f80c]" />
                <div>
                  <p className="text-white font-medium">Wholesaler Applications</p>
                  <p className="text-gray-500 text-xs">Always enabled</p>
                </div>
              </div>
              <Badge className="bg-green-500/20 text-green-400">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <Store className="w-5 h-5 text-[#ff66c4]" />
                <div>
                  <p className="text-white font-medium">Distributor Applications</p>
                  <p className="text-gray-500 text-xs">Always enabled</p>
                </div>
              </div>
              <Badge className="bg-green-500/20 text-green-400">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0a0514] rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#ff66c4]" />
                <div>
                  <p className="text-white font-medium">Influencer Applications</p>
                  <p className="text-gray-500 text-xs">Admin controlled</p>
                </div>
              </div>
              <Badge className={influencerAppsEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-500'}>
                {influencerAppsEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Processor Configuration */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#44f80c]" />
            Payment Processor — High Wire Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-[#0a0514] rounded-lg border border-white/10">
              <Server className="w-5 h-5 text-[#44f80c] mt-0.5" />
              <div>
                <p className="text-white font-medium">Processor</p>
                <p className="text-gray-400 text-sm">High Wire Payments (high-risk merchant services)</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-[#0a0514] rounded-lg border border-white/10">
              <Link className="w-5 h-5 text-[#ff66c4] mt-0.5" />
              <div>
                <p className="text-white font-medium">Integration Status</p>
                <p className="text-gray-400 text-sm">
                  Placeholder / hook mode — API credentials required from High Wire account manager.
                  When credentials are entered below, the &quot;Pay Now&quot; button will appear on invoices.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-[#0a0514] rounded-lg border border-white/10">
              <Key className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-white font-medium">Required Credentials</p>
                <ul className="text-gray-400 text-sm space-y-1 mt-1">
                  <li>• Client ID / Merchant ID</li>
                  <li>• API Key / Secret</li>
                  <li>• API Endpoint URL (test or live)</li>
                  <li>• Webhook Secret (for payment notifications)</li>
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                Credentials are stored in app_config (see table below — keys prefixed with <code className="text-[#44f80c]">payment_</code>).
              </p>
              <Badge className="bg-yellow-500/10 text-yellow-400">NOT CONFIGURED</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Config Table */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search config keys..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
        </div>
        <button onClick={() => { setEditingConfig(null); setFormData({ key: '', value: '', description: '' }); setShowModal(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-[#9a02d0] hover:bg-[#9a02d0]/80 rounded-lg text-sm text-white transition-colors">
          <Plus className="w-4 h-4" /> Add Config
        </button>
      </div>

      <div className="bg-[#150f24] border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : configs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No configuration items found</div>
        ) : (
          <div className="divide-y divide-white/10">
            {configs.map(c => (
              <div key={c.id} className="p-4 hover:bg-white/5 transition-colors flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <code className="text-sm font-mono text-[#44f80c] bg-[#9a02d0]/10 px-2 py-0.5 rounded">{c.key}</code>
                    <span className="text-xs text-gray-500">{formatDate(c.updated_at)}</span>
                  </div>
                  <div className="text-sm text-gray-300 mb-1 truncate">{c.value}</div>
                  {c.description && <div className="text-xs text-gray-500">{c.description}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-[#44f80c]"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">{editingConfig ? 'Edit Config' : 'Add Config'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Key</label>
                <input type="text" value={formData.key} onChange={e => setFormData({...formData, key: e.target.value})} disabled={!!editingConfig}
                  className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50 disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Value</label>
                <textarea value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} rows={3}
                  className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-white/10">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 rounded-lg text-sm text-gray-300">Cancel</button>
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2.5 bg-[#9a02d0] hover:bg-[#9a02d0]/80 rounded-lg text-sm text-white">
                <Save className="w-4 h-4" /> {editingConfig ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
