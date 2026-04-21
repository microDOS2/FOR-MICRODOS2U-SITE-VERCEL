import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { downloadCSV, formatDate } from '@/lib/utils'
import { geocodeAddress } from '@/lib/geocode'
import { Search, Download, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Store, Globe, MapPin, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DBUser } from '@/lib/supabase'

interface StoreItem {
  id: string
  user_id: string
  name: string | null
  address: string
  city: string | null
  state: string | null
  zip: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  email: string | null
  website: string | null
  stock: string | null
  license_number: string | null
  is_primary: boolean
  is_active: boolean
  source: string | null
  created_at: string
  updated_at: string
  owner?: DBUser | null
}

export function StoresPage() {
  const [stores, setStores] = useState<StoreItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editingStore, setEditingStore] = useState<StoreItem | null>(null)
  const [users, setUsers] = useState<DBUser[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at' | 'name'>('updated_at')
  const [sortAsc, setSortAsc] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    user_id: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    lat: '',
    lng: '',
    phone: '',
    email: '',
    website: '',
    stock: 'In Stock',
    license_number: '',
    is_primary: false,
    is_active: true,
  })

  const pageSize = 10

  // Fetch approved wholesalers and distributors for the dropdown
  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('status', 'approved')
      .in('role', ['wholesaler', 'distributor'])
      .order('business_name', { ascending: true })
    setUsers((data as DBUser[]) || [])
  }

  const fetchStores = useCallback(async () => {
    setLoading(true)
    try {
      // Get all stores with owner info
      let query = supabase
        .from('wholesaler_store_locations')
        .select('*, users:user_id(*)', { count: 'exact' })
        .order(sortBy, { ascending: sortAsc })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (search) {
        query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%,city.ilike.%${search}%`)
      }

      const { data, count, error } = await query
      if (error) {
        console.error(error)
      } else {
        const transformed = (data || []).map((s: any) => ({
          ...s,
          owner: s.users,
        }))
        setStores(transformed)
        setTotalCount(count || 0)
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }, [page, search, sortBy, sortAsc])

  useEffect(() => {
    fetchStores()
    fetchUsers()
  }, [fetchStores])

  // Auto-geocode when address changes (if lat/lng not manually entered)
  const handleAddressBlur = async () => {
    if (!formData.address || formData.lat || formData.lng) return
    setGeocoding(true)
    const result = await geocodeAddress(formData.address)
    if (result) {
      setFormData((prev) => ({
        ...prev,
        lat: String(result.lat),
        lng: String(result.lng),
        city: result.city || prev.city,
        state: result.state || prev.state,
        zip: result.zip || prev.zip,
      }))
    }
    setGeocoding(false)
  }

  const handleSave = async () => {
    const payload: any = {
      name: formData.name,
      user_id: formData.user_id,
      address: formData.address,
      city: formData.city || null,
      state: formData.state || null,
      zip: formData.zip || null,
      lat: formData.lat ? parseFloat(formData.lat) : null,
      lng: formData.lng ? parseFloat(formData.lng) : null,
      phone: formData.phone || null,
      email: formData.email || null,
      website: formData.website || null,
      stock: formData.stock,
      license_number: formData.license_number || null,
      is_primary: formData.is_primary,
      is_active: formData.is_active,
      source: editingStore ? editingStore.source : 'admin',
    }

    if (editingStore) {
      const { error } = await supabase
        .from('wholesaler_store_locations')
        .update(payload)
        .eq('id', editingStore.id)
      if (error) alert('Error: ' + error.message)
    } else {
      payload.source = 'admin'
      const { error } = await supabase
        .from('wholesaler_store_locations')
        .insert([payload])
      if (error) alert('Error: ' + error.message)
    }

    setShowModal(false)
    setEditingStore(null)
    resetForm()
    fetchStores()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this store?')) return
    const { error } = await supabase
      .from('wholesaler_store_locations')
      .delete()
      .eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchStores()
  }

  const openEdit = (s: StoreItem) => {
    setEditingStore(s)
    setFormData({
      name: s.name || '',
      user_id: s.user_id || '',
      address: s.address || '',
      city: s.city || '',
      state: s.state || '',
      zip: s.zip || '',
      lat: s.lat != null ? String(s.lat) : '',
      lng: s.lng != null ? String(s.lng) : '',
      phone: s.phone || '',
      email: s.email || '',
      website: s.website || '',
      stock: s.stock || 'In Stock',
      license_number: (s as any).license_number || '',
      is_primary: s.is_primary || false,
      is_active: s.is_active ?? true,
    })
    setShowModal(true)
  }

  const resetForm = () =>
    setFormData({
      name: '',
      user_id: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      lat: '',
      lng: '',
      phone: '',
      email: '',
      website: '',
      stock: 'In Stock',
      license_number: '',
      is_primary: false,
      is_active: true,
    })

  const exportCSV = () => {
    downloadCSV(
      'stores',
      ['ID', 'Name', 'Owner', 'Role', 'Address', 'City', 'State', 'ZIP', 'Phone', 'Email', 'Website', 'Stock', 'Status', 'Last Updated'],
      stores.map((s) => [
        s.id,
        s.name || '',
        s.owner?.business_name || s.owner?.email || s.user_id,
        s.owner?.role || '',
        s.address,
        s.city || '',
        s.state || '',
        s.zip || '',
        s.phone || '',
        s.email || '',
        s.website || '',
        s.stock || '',
        s.is_active ? 'Active' : 'Inactive',
        s.updated_at,
      ])
    )
  }

  const wholesalers = users.filter((u) => u.role === 'wholesaler')
  const distributors = users.filter((u) => u.role === 'distributor')

  const totalPages = Math.ceil(totalCount / pageSize)

  // Toggle sort
  const handleSort = (column: 'updated_at' | 'created_at' | 'name') => {
    if (sortBy === column) {
      setSortAsc(!sortAsc)
    } else {
      setSortBy(column)
      setSortAsc(false)
    }
    setPage(0)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search stores..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => {
              setEditingStore(null)
              resetForm()
              setShowModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#9a02d0] hover:bg-[#7a01a8] rounded-lg text-sm text-white transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Store
          </button>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500">Sort by:</span>
        {[
          { key: 'updated_at' as const, label: 'Last Updated' },
          { key: 'created_at' as const, label: 'Created' },
          { key: 'name' as const, label: 'Name' },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleSort(opt.key)}
            className={cn(
              'px-3 py-1 rounded-lg text-sm transition-colors',
              sortBy === opt.key
                ? 'bg-[#9a02d0]/20 text-[#9a02d0] border border-[#9a02d0]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            {opt.label} {sortBy === opt.key && (sortAsc ? '↑' : '↓')}
          </button>
        ))}
      </div>

      {/* Store Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading stores...
          </div>
        ) : stores.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">No stores found</div>
        ) : (
          stores.map((s) => (
            <div
              key={s.id}
              className="bg-[#150f24] border border-white/10 rounded-xl p-5 hover:border-[#9a02d0]/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-[#9a02d0]/10 rounded-lg">
                  <Store className="w-5 h-5 text-[#44f80c]" />
                </div>
                <div className="flex items-center gap-2">
                  {/* Updated at badge */}
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-[#0a0514] px-2 py-1 rounded-lg">
                    <Clock className="w-3 h-3" />
                    {formatDate(s.updated_at)}
                  </span>
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium',
                      s.is_active
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    )}
                  >
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{s.name || 'Unnamed Store'}</h3>
              <p className="text-sm text-gray-400 mb-3">
                Owner: {s.owner?.business_name || s.owner?.email || 'Unknown'}
                {s.owner?.role && (
                  <span
                    className={cn(
                      'ml-2 text-[10px] px-1.5 py-0.5 rounded-full uppercase',
                      s.owner.role === 'wholesaler'
                        ? 'bg-[#44f80c]/20 text-[#44f80c]'
                        : 'bg-[#9a02d0]/20 text-[#9a02d0]'
                    )}
                  >
                    {s.owner.role}
                  </span>
                )}
              </p>
              <div className="space-y-1.5 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-600" />
                  <span>
                    {s.address}
                    {s.city && `, ${s.city}`}
                    {s.state && `, ${s.state}`}
                    {s.zip && ` ${s.zip}`}
                  </span>
                </div>
                {s.phone && <p>{s.phone}</p>}
                {s.email && <p className="truncate">{s.email}</p>}
                {s.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[#44f80c]" />
                    <span className="text-[#44f80c] truncate">{s.website}</span>
                  </div>
                )}
                {s.stock && (
                  <span
                    className={cn(
                      'inline-block text-xs px-2 py-0.5 rounded-full',
                      s.stock === 'In Stock'
                        ? 'bg-green-500/15 text-green-400'
                        : s.stock === 'Low Stock'
                          ? 'bg-yellow-500/15 text-yellow-400'
                          : 'bg-red-500/15 text-red-400'
                    )}
                  >
                    {s.stock}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  onClick={() => openEdit(s)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-[#44f80c]"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="flex items-center justify-between bg-[#150f24] border border-white/10 rounded-xl px-4 py-3">
          <span className="text-sm text-gray-500">{totalCount} total</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-400">
              Page {page + 1} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">
                {editingStore ? 'Edit Store' : 'Add Store'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/5 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Store Name */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Store Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                />
              </div>

              {/* Owner: Two-section dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Assigned Account <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                >
                  <option value="">Select an account...</option>

                  {wholesalers.length > 0 && (
                    <optgroup label="Wholesalers">
                      {wholesalers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.business_name || u.email}
                          {u.city && u.state ? ` — ${u.city}, ${u.state}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {distributors.length > 0 && (
                    <optgroup label="Distributors">
                      {distributors.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.business_name || u.email}
                          {u.city && u.state ? ` — ${u.city}, ${u.state}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {wholesalers.length === 0 && distributors.length === 0 && (
                  <p className="text-xs text-yellow-500 mt-1">
                    No approved wholesalers or distributors found. Approve accounts first.
                  </p>
                )}
              </div>

              {/* Address with geocoding */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Street Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    onBlur={handleAddressBlur}
                    rows={2}
                    className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50 pr-10"
                  />
                  {geocoding && (
                    <Loader2 className="absolute right-3 top-3 w-4 h-4 text-[#9a02d0] animate-spin" />
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  City, state, and coordinates will auto-fill when you leave this field.
                </p>
              </div>

              {/* City / State / ZIP */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">ZIP</label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
              </div>

              {/* Lat / Lng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Latitude</label>
                  <input
                    type="text"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                    placeholder="Auto-filled from address"
                    className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Longitude</label>
                  <input
                    type="text"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                    placeholder="Auto-filled from address"
                    className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
              </div>

              {/* Phone / Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Website</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="www.example.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                  />
                </div>
              </div>

              {/* Stock */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Stock Status</label>
                <select
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                >
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>

              {/* License */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Business License #
                </label>
                <input
                  type="text"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_primary}
                    onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                    className="w-4 h-4 accent-[#9a02d0]"
                  />
                  Primary location
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 accent-[#9a02d0]"
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-white/10">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 rounded-lg text-sm text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.user_id || !formData.address}
                className="px-4 py-2.5 bg-[#9a02d0] hover:bg-[#7a01a8] rounded-lg text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingStore ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
