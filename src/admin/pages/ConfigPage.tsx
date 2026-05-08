import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { Search, Plus, Pencil, Trash2, X, Save, Settings, Users, Store, ToggleLeft, ToggleRight, CreditCard, Link, Server, Key, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

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

  // Payment processor config state
  const [paymentConfig, setPaymentConfig] = useState({
    processor: 'authorize_net',
    mode: 'test' as 'test' | 'live',
    clientId: '',
    apiKey: '',
    publicClientKey: '',
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentConfigStatus, setPaymentConfigStatus] = useState<'not_configured' | 'configured'>('not_configured')

  useEffect(() => { fetchConfigs(); fetchAppConfig(); fetchPaymentConfig() }, [search])

  const fetchPaymentConfig = async () => {
    try {
      const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
          'payment_processor',
          'payment_mode',
          'payment_client_id',
          'payment_api_key',
          'payment_public_client_key',
        ])
      const map = new Map((data || []).map((r: any) => [r.key, r.value]))
      const proc = map.get('payment_processor') || 'authorize_net'
      const mode = (map.get('payment_mode') as 'test' | 'live') || 'test'
      const clientId = map.get('payment_client_id') || ''
      const apiKey = map.get('payment_api_key') || ''
      const publicKey = map.get('payment_public_client_key') || ''
      setPaymentConfig({ processor: proc, mode, clientId, apiKey, publicClientKey: publicKey })
      const hasCreds = clientId.length > 0 && apiKey.length > 0
      setPaymentConfigStatus(hasCreds ? 'configured' : 'not_configured')
    } catch {
      // Leave defaults
    }
  }

  const savePaymentConfig = async () => {
    setSavingPayment(true)
    try {
      const endpointUrl = paymentConfig.mode === 'live'
        ? 'https://api.authorize.net/xml/v1/request.api'
        : 'https://apitest.authorize.net/xml/v1/request.api'

      const entries = [
        { key: 'payment_processor', value: paymentConfig.processor, description: 'Active payment processor (authorize_net or high_wire_payments)' },
        { key: 'payment_mode', value: paymentConfig.mode, description: 'Payment mode: test or live' },
        { key: 'payment_client_id', value: paymentConfig.clientId, description: 'Authorize.net API Login ID' },
        { key: 'payment_api_key', value: paymentConfig.apiKey, description: 'Authorize.net Transaction Key' },
        { key: 'payment_public_client_key', value: paymentConfig.publicClientKey, description: 'Authorize.net Public Client Key for Accept.js' },
        { key: 'payment_endpoint_url', value: endpointUrl, description: 'Authorize.net API endpoint URL (auto-set by mode)' },
        { key: 'payment_webhook_secret', value: '', description: 'Webhook secret for payment notifications (optional)' },
      ]

      for (const entry of entries) {
        const { error } = await supabase.from('app_config').upsert(
          { key: entry.key, value: entry.value, description: entry.description, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
        if (error) {
          alert('Failed to save ' + entry.key + ': ' + error.message)
          setSavingPayment(false)
          return
        }
      }

      const hasCreds = paymentConfig.clientId.length > 0 && paymentConfig.apiKey.length > 0
      setPaymentConfigStatus(hasCreds ? 'configured' : 'not_configured')
      await fetchConfigs() // Refresh the config table below
      alert('Authorize.net configuration saved!')
    } catch (err: any) {
      alert(err?.message || 'Failed to save payment config')
    }
    setSavingPayment(false)
  }

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

      {/* Payment Processor Configuration — Authorize.net */}
      <Card className="bg-[#150f24] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#44f80c]" />
            Payment Processor — Authorize.net
            {paymentConfigStatus === 'configured' ? (
              <Badge className="bg-green-500/20 text-green-400 ml-2"><CheckCircle className="w-3 h-3 mr-1" /> CONFIGURED</Badge>
            ) : (
              <Badge className="bg-yellow-500/10 text-yellow-400 ml-2"><AlertCircle className="w-3 h-3 mr-1" /> NOT CONFIGURED</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {/* Processor + Mode row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Processor</label>
                <select
                  value={paymentConfig.processor}
                  onChange={(e) => setPaymentConfig({ ...paymentConfig, processor: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                >
                  <option value="authorize_net">Authorize.net</option>
                  <option value="high_wire_payments">High Wire Payments</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPaymentConfig({ ...paymentConfig, mode: 'test' })}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      paymentConfig.mode === 'test'
                        ? 'bg-[#ff66c4]/20 border-[#ff66c4] text-[#ff66c4]'
                        : 'bg-[#0a0514] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    Sandbox (Test)
                  </button>
                  <button
                    onClick={() => setPaymentConfig({ ...paymentConfig, mode: 'live' })}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      paymentConfig.mode === 'live'
                        ? 'bg-green-500/20 border-green-500 text-green-400'
                        : 'bg-[#0a0514] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    Live
                  </button>
                </div>
              </div>
            </div>

            {/* API Login ID */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">API Login ID</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={paymentConfig.clientId}
                  onChange={(e) => setPaymentConfig({ ...paymentConfig, clientId: e.target.value })}
                  placeholder="Your Authorize.net API Login ID"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Found in your Authorize.net Merchant Interface under Account → API Login ID & Transaction Key</p>
            </div>

            {/* Transaction Key */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Transaction Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={paymentConfig.apiKey}
                  onChange={(e) => setPaymentConfig({ ...paymentConfig, apiKey: e.target.value })}
                  placeholder="Your Authorize.net Transaction Key"
                  className="w-full pl-10 pr-12 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  title={showApiKey ? 'Hide' : 'Show'}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Keep this secret. Used server-side only via Edge Function.</p>
            </div>

            {/* Public Client Key (for Accept.js) */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Public Client Key <span className="text-gray-600">(for Accept.js)</span></label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={paymentConfig.publicClientKey}
                  onChange={(e) => setPaymentConfig({ ...paymentConfig, publicClientKey: e.target.value })}
                  placeholder="Your Authorize.net Public Client Key"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Generate at Account → Security Settings → Manage Public Client Key. Used client-side to tokenize cards.
              </p>
            </div>

            {/* Endpoint URL (read-only, auto-set) */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">API Endpoint <span className="text-gray-600">(auto-set)</span></label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  readOnly
                  value={paymentConfig.mode === 'live' ? 'https://api.authorize.net/xml/v1/request.api' : 'https://apitest.authorize.net/xml/v1/request.api'}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0a0514]/50 border border-white/5 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Save button */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                Credentials stored encrypted in app_config table. Transaction Key never exposed to frontend after save.
              </p>
              <button
                onClick={savePaymentConfig}
                disabled={savingPayment}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#44f80c] to-[#9a02d0] hover:opacity-90 rounded-lg text-sm text-white font-medium transition-opacity disabled:opacity-50"
              >
                {savingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Payment Config
              </button>
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
