import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { downloadCSV, formatCurrency } from '@/lib/utils'
import { Search, Download, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  retail_price: number | null
  sku: string | null
  stock: number
  min_order: number
  image_url: string | null
  is_active: boolean
  created_at: string
}

interface Variant {
  product_id: string
  tier: string
  name: string
  quantity: number
  total_pills: number
  sku: string
  msrp_price: number
  wholesaler_price: number
  distributor_price: number
  in_stock: boolean
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '', description: '', price: 0, retail_price: 0, sku: '', stock: 0, min_order: 1, is_active: true
  })
  const pageSize = 10

  useEffect(() => { fetchProducts() }, [page, search])

  const fetchProducts = async () => {
    setLoading(true)
    let query = supabase.from('products').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1)
    if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`)
    const { data, count, error } = await query
    if (error) console.error(error)
    else { setProducts(data || []); setTotalCount(count || 0) }

    // Fetch variants from site_settings
    try {
      const { data: setting } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'product_variants')
        .single()
      if (setting?.value && (setting.value as any).variants) {
        setVariants((setting.value as any).variants as Variant[])
      }
    } catch {
      // No variants configured yet
    }

    setLoading(false)
  }

  const handleSave = async () => {
    const payload = {
      ...formData,
      price: Number(formData.price),
      retail_price: Number(formData.retail_price),
      stock: Number(formData.stock),
      min_order: Number(formData.min_order),
      is_active: formData.is_active,
    }
    if (editingProduct) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id)
      if (error) alert('Error: ' + error.message)
    } else {
      const { error } = await supabase.from('products').insert([payload])
      if (error) alert('Error: ' + error.message)
    }
    setShowModal(false); setEditingProduct(null); resetForm(); fetchProducts()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchProducts()
  }

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setFormData({
      name: p.name, description: p.description || '', price: p.price, retail_price: p.retail_price || 0,
      sku: p.sku || '', stock: p.stock, min_order: p.min_order, is_active: p.is_active
    })
    setShowModal(true)
  }

  const resetForm = () => setFormData({ name: '', description: '', price: 0, retail_price: 0, sku: '', stock: 0, min_order: 1, is_active: true })

  const exportCSV = () => {
    downloadCSV('products', ['ID', 'Name', 'SKU', 'Price', 'Retail Price', 'Stock', 'Min Order', 'Active', 'Created'],
      products.map(p => [p.id, p.name, p.sku || '', String(p.price), String(p.retail_price || ''), String(p.stock), String(p.min_order), p.is_active ? 'Yes' : 'No', p.created_at]))
  }

  const getProductVariants = (productId: string) => variants.filter(v => v.product_id === productId)

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-10 pr-4 py-2.5 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { setEditingProduct(null); resetForm(); setShowModal(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-[#9a02d0] hover:bg-[#9a02d0] rounded-lg text-sm text-white transition-colors">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      <div className="bg-[#150f24] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Distributor Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">MSRP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Variants</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No products found</td></tr>
              ) : products.map(p => {
                const pVariants = getProductVariants(p.id)
                const isExpanded = expandedProduct === p.id
                return (
                  <>
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#0a0514] border border-white/10 flex items-center justify-center text-lg">
                            {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover rounded-lg" alt="" /> : <PkgIcon className="w-5 h-5 text-gray-500" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{p.name}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{p.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 font-mono">{p.sku || '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-[#44f80c]">{formatCurrency(p.price)}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{p.retail_price ? formatCurrency(p.retail_price) : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-sm', p.stock < 10 ? 'text-red-400' : p.stock < 50 ? 'text-amber-400' : 'text-emerald-400')}>{p.stock}</span>
                      </td>
                      <td className="px-4 py-3">
                        {pVariants.length > 0 ? (
                          <button
                            onClick={() => setExpandedProduct(isExpanded ? null : p.id)}
                            className="flex items-center gap-1 text-xs text-[#9a02d0] hover:text-[#44f80c] transition-colors"
                          >
                            {pVariants.length} variant{pVariants.length > 1 ? 's' : ''}
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-[#44f80c]"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && pVariants.length > 0 && (
                      <tr key={`${p.id}-variants`}>
                        <td colSpan={7} className="px-4 py-3 bg-[#0a0514]/50">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Packaging Variants</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {pVariants.map(v => (
                                <div key={v.sku} className="bg-[#150f24] border border-white/10 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-white">{v.name}</span>
                                    <span className={cn('text-xs px-2 py-0.5 rounded-full', v.in_stock ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
                                      {v.in_stock ? 'In Stock' : 'Out'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 font-mono mb-1">{v.sku}</p>
                                  <div className="flex items-center gap-3 text-xs">
                                    <span className="text-gray-500"><span className="text-gray-400">{v.quantity}</span> units</span>
                                    <span className="text-gray-600">|</span>
                                    <span className="text-gray-500"><span className="text-gray-400">{v.total_pills}</span> pills</span>
                                  </div>
                                  <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                                    <span className="text-gray-400">MSRP: <span className="text-white">{formatCurrency(v.msrp_price)}</span></span>
                                    <span className="text-gray-400">W: <span className="text-amber-400">{formatCurrency(v.wholesaler_price)}</span></span>
                                    <span className="text-gray-400">D: <span className="text-[#44f80c]">{formatCurrency(v.distributor_price)}</span></span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
          <span className="text-sm text-gray-500">{totalCount} total</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm text-gray-400">Page {page + 1} of {totalPages || 1}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Distributor Price ($)</label>
                  <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">MSRP ($)</label>
                  <input type="number" step="0.01" value={formData.retail_price} onChange={e => setFormData({...formData, retail_price: Number(e.target.value)})} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Stock</label>
                  <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Min Order</label>
                  <input type="number" value={formData.min_order} onChange={e => setFormData({...formData, min_order: Number(e.target.value)})} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">SKU</label>
                <input type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  className="w-4 h-4 rounded border-white/10 bg-[#0a0514] text-[#9a02d0] focus:ring-[#9a02d0]"
                />
                <label htmlFor="is_active" className="text-sm text-gray-300">Active</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-white/10">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 rounded-lg text-sm text-gray-300">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2.5 bg-[#9a02d0] hover:bg-[#9a02d0] rounded-lg text-sm text-white">{editingProduct ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PkgIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
}
