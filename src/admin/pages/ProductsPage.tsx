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
  wholesaler_price: number | null
  retail_price: number | null
  sku: string | null
  stock: number
  min_order: number
  image_url: string | null
  is_active: boolean
  created_at: string
}

interface Variant {
  id: string
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

const emptyVariantForm = {
  id: '', product_id: '', tier: 'individual', name: '', quantity: 1, total_pills: 0,
  sku: '', msrp_price: 0, wholesaler_price: 0, distributor_price: 0, in_stock: true
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
  const [activeTab, setActiveTab] = useState<'details' | 'variants'>('details')
  const [formData, setFormData] = useState({
    name: '', description: '', price: 0, wholesaler_price: 0, retail_price: 0, sku: '', stock: 0, min_order: 1, is_active: true
  })
  const [variantForm, setVariantForm] = useState({ ...emptyVariantForm })
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [showVariantForm, setShowVariantForm] = useState(false)
  const pageSize = 10

  useEffect(() => { fetchProducts() }, [page, search])

  const fetchProducts = async () => {
    setLoading(true)
    let query = supabase.from('products').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1)
    if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`)
    const { data, count, error } = await query
    if (error) console.error(error)
    else { setProducts(data || []); setTotalCount(count || 0) }

    // Fetch ALL variants from the real product_variants table
    const { data: vData, error: vError } = await supabase
      .from('product_variants')
      .select('*')
      .order('sku')
    if (!vError && vData) setVariants(vData as Variant[])

    setLoading(false)
  }

  const handleSave = async () => {
    const payload = {
      ...formData,
      price: Number(formData.price),
      wholesaler_price: Number(formData.wholesaler_price),
      retail_price: Number(formData.retail_price),
      stock: Number(formData.stock),
      min_order: Number(formData.min_order),
      is_active: formData.is_active,
    }
    if (editingProduct) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id)
      if (error) alert('Error: ' + error.message)
      else { fetchProducts() }
    } else {
      // Insert and get the new product back so we can add variants immediately
      const { data, error } = await supabase.from('products').insert([payload]).select().single()
      if (error) {
        alert('Error: ' + error.message)
        return
      }
      if (data) {
        // Load the new product into edit mode so variants can be added
        setEditingProduct(data as Product)
        setActiveTab('variants')
        fetchProducts()
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product and all its variants?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchProducts()
  }

  // --- Variant CRUD ---
  const getProductVariants = (productId: string) => variants.filter(v => v.product_id === productId)

  const openVariantForm = (v?: Variant) => {
    if (v) {
      setVariantForm({ ...v })
      setEditingVariantId(v.id)
    } else {
      setVariantForm({ ...emptyVariantForm, product_id: editingProduct?.id || '' })
      setEditingVariantId(null)
    }
    setShowVariantForm(true)
  }

  const saveVariant = async () => {
    const payload = {
      product_id: editingProduct?.id || variantForm.product_id,
      tier: variantForm.tier,
      name: variantForm.name,
      quantity: Number(variantForm.quantity),
      total_pills: Number(variantForm.total_pills),
      sku: variantForm.sku,
      msrp_price: Number(variantForm.msrp_price),
      wholesaler_price: Number(variantForm.wholesaler_price),
      distributor_price: Number(variantForm.distributor_price),
      in_stock: variantForm.in_stock,
    }
    if (editingVariantId) {
      const { error } = await supabase.from('product_variants').update(payload).eq('id', editingVariantId)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const { error } = await supabase.from('product_variants').insert([payload])
      if (error) { alert('Error: ' + error.message); return }
    }
    setShowVariantForm(false)
    setEditingVariantId(null)
    setVariantForm({ ...emptyVariantForm })
    fetchProducts()
  }

  const deleteVariant = async (id: string) => {
    if (!confirm('Delete this variant?')) return
    const { error } = await supabase.from('product_variants').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchProducts()
  }
  // --- End Variant CRUD ---

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setFormData({
      name: p.name, description: p.description || '', price: p.price, wholesaler_price: p.wholesaler_price || 0, retail_price: p.retail_price || 0,
      sku: p.sku || '', stock: p.stock, min_order: p.min_order, is_active: p.is_active
    })
    setActiveTab('details')
    setShowVariantForm(false)
    setEditingVariantId(null)
    setShowModal(true)
  }

  const openCreate = () => {
    setEditingProduct(null)
    resetForm()
    setActiveTab('details')
    setShowVariantForm(false)
    setEditingVariantId(null)
    setShowModal(true)
  }

  const resetForm = () => setFormData({ name: '', description: '', price: 0, wholesaler_price: 0, retail_price: 0, sku: '', stock: 0, min_order: 1, is_active: true })

  const exportCSV = () => {
    downloadCSV('products', ['ID', 'Name', 'SKU', 'Distributor Price', 'Wholesaler Price', 'MSRP', 'Stock', 'Min Order', 'Active', 'Variants', 'Created'],
      products.map(p => [p.id, p.name, p.sku || '', String(p.price), String(p.wholesaler_price || ''), String(p.retail_price || ''), String(p.stock), String(p.min_order), p.is_active ? 'Yes' : 'No', String(getProductVariants(p.id).length), p.created_at]))
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-4">
      {/* Header controls */}
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
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-[#9a02d0] hover:bg-[#7a01a8] rounded-lg text-sm text-white transition-colors">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-[#150f24] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Distributor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Wholesaler</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">MSRP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Variants</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No products found</td></tr>
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
                      <td className="px-4 py-3 text-sm font-medium text-amber-400">{p.wholesaler_price ? formatCurrency(p.wholesaler_price) : '-'}</td>
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
                          <span className="text-xs text-gray-500">0 variants</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-[#44f80c]"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${p.id}-variants`}>
                        <td colSpan={7} className="px-4 py-3 bg-[#0a0514]/50">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Packaging Variants</p>
                            {pVariants.length === 0 ? (
                              <p className="text-xs text-gray-500 italic">No variants defined. Edit product to add variants.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {pVariants.map(v => (
                                  <div key={v.id} className="bg-[#150f24] border border-white/10 rounded-lg p-3">
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
                                      <span className="text-gray-600">|</span>
                                      <span className="text-gray-500">{v.tier}</span>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                                      <span className="text-gray-400">MSRP: <span className="text-white">{formatCurrency(v.msrp_price)}</span></span>
                                      <span className="text-gray-400">W: <span className="text-amber-400">{formatCurrency(v.wholesaler_price)}</span></span>
                                      <span className="text-gray-400">D: <span className="text-[#44f80c]">{formatCurrency(v.distributor_price)}</span></span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
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

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
              <h3 className="text-lg font-semibold text-white">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 flex-shrink-0">
              <button
                onClick={() => setActiveTab('details')}
                className={cn('px-5 py-3 text-sm font-medium transition-colors', activeTab === 'details' ? 'text-[#44f80c] border-b-2 border-[#44f80c]' : 'text-gray-400 hover:text-white')}
              >Product Details</button>
              <button
                onClick={() => setActiveTab('variants')}
                className={cn('px-5 py-3 text-sm font-medium transition-colors', activeTab === 'variants' ? 'text-[#44f80c] border-b-2 border-[#44f80c]' : 'text-gray-400 hover:text-white')}
              >Variants ({editingProduct ? getProductVariants(editingProduct.id).length : 0})</button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'details' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Name</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
                    <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2}
                      className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">Distributor Price ($)</label>
                      <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                        className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">Wholesaler Price ($)</label>
                      <input type="number" step="0.01" value={formData.wholesaler_price} onChange={e => setFormData({...formData, wholesaler_price: Number(e.target.value)})}
                        className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">MSRP ($)</label>
                      <input type="number" step="0.01" value={formData.retail_price} onChange={e => setFormData({...formData, retail_price: Number(e.target.value)})}
                        className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">Stock</label>
                      <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                        className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">Min Order</label>
                      <input type="number" value={formData.min_order} onChange={e => setFormData({...formData, min_order: Number(e.target.value)})}
                        className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">SKU</label>
                    <input type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})}
                      className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="is_active" checked={formData.is_active}
                      onChange={e => setFormData({...formData, is_active: e.target.checked})}
                      className="w-4 h-4 rounded border-white/10 bg-[#0a0514] text-[#9a02d0] focus:ring-[#9a02d0]" />
                    <label htmlFor="is_active" className="text-sm text-gray-300">Active</label>
                  </div>
                </div>
              ) : (
                /* Variants Tab */
                <div className="space-y-4">
                  {/* If product not saved yet, prompt to save first */}
                  {!editingProduct && (
                    <div className="text-center py-8 text-gray-500">
                      <PkgIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Save the product details first, then you can add packaging variants here.</p>
                    </div>
                  )}

                  {/* Existing Variants List */}
                  {editingProduct && getProductVariants(editingProduct.id).length === 0 && !showVariantForm && (
                    <div className="text-center py-8 text-gray-500">
                      <PkgIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No variants yet. Add one to make this product visible on the catalog.</p>
                    </div>
                  )}

                  {editingProduct && getProductVariants(editingProduct.id).map(v => (
                    <div key={v.id} className="bg-[#0a0514] border border-white/10 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-white">{v.name}</span>
                            <span className="text-xs text-gray-500 uppercase bg-white/5 px-2 py-0.5 rounded">{v.tier}</span>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full', v.in_stock ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
                              {v.in_stock ? 'In Stock' : 'Out'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 font-mono mb-2">{v.sku}</p>
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="text-gray-500">Quantity</span>
                              <p className="text-gray-300">{v.quantity}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Pills</span>
                              <p className="text-gray-300">{v.total_pills}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">MSRP</span>
                              <p className="text-white">{formatCurrency(v.msrp_price)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Wholesaler</span>
                              <p className="text-amber-400">{formatCurrency(v.wholesaler_price)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Distributor</span>
                              <p className="text-[#44f80c]">{formatCurrency(v.distributor_price)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <button onClick={() => openVariantForm(v)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-[#44f80c]"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteVariant(v.id)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add/Edit Variant Form */}
                  {showVariantForm && (
                    <div className="bg-[#0a0514] border border-[#9a02d0]/30 rounded-lg p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-white">
                        {editingVariantId ? 'Edit Variant' : 'Add Variant'}
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Tier</label>
                          <select value={variantForm.tier} onChange={e => setVariantForm({...variantForm, tier: e.target.value})}
                            className="w-full px-3 py-2 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50">
                            <option value="individual">Individual</option>
                            <option value="case">Case</option>
                            <option value="master_case">Master Case</option>
                            <option value="special">Special</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
                          <input type="text" value={variantForm.name} onChange={e => setVariantForm({...variantForm, name: e.target.value})} placeholder="e.g. Case (12 boxes)"
                            className="w-full px-3 py-2 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Quantity</label>
                          <input type="number" value={variantForm.quantity} onChange={e => setVariantForm({...variantForm, quantity: Number(e.target.value)})}
                            className="w-full px-3 py-2 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Total Pills</label>
                          <input type="number" value={variantForm.total_pills} onChange={e => setVariantForm({...variantForm, total_pills: Number(e.target.value)})}
                            className="w-full px-3 py-2 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">SKU</label>
                          <input type="text" value={variantForm.sku} onChange={e => setVariantForm({...variantForm, sku: e.target.value})} placeholder="MD2-BX-012"
                            className="w-full px-3 py-2 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">MSRP ($)</label>
                          <input type="number" step="0.01" value={variantForm.msrp_price} onChange={e => setVariantForm({...variantForm, msrp_price: Number(e.target.value)})}
                            className="w-full px-3 py-2 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Wholesaler ($)</label>
                          <input type="number" step="0.01" value={variantForm.wholesaler_price} onChange={e => setVariantForm({...variantForm, wholesaler_price: Number(e.target.value)})}
                            className="w-full px-3 py-2 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Distributor ($)</label>
                          <input type="number" step="0.01" value={variantForm.distributor_price} onChange={e => setVariantForm({...variantForm, distributor_price: Number(e.target.value)})}
                            className="w-full px-3 py-2 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="v_in_stock" checked={variantForm.in_stock}
                          onChange={e => setVariantForm({...variantForm, in_stock: e.target.checked})}
                          className="w-4 h-4 rounded border-white/10 bg-[#150f24] text-[#9a02d0]" />
                        <label htmlFor="v_in_stock" className="text-xs text-gray-300">In Stock</label>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => { setShowVariantForm(false); setEditingVariantId(null) }}
                          className="px-3 py-2 bg-[#150f24] hover:bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300">Cancel</button>
                        <button onClick={saveVariant}
                          className="px-3 py-2 bg-[#9a02d0] hover:bg-[#7a01a8] rounded-lg text-xs text-white">{editingVariantId ? 'Update Variant' : 'Create Variant'}</button>
                      </div>
                    </div>
                  )}

                  {!showVariantForm && editingProduct && (
                    <button onClick={() => openVariantForm()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0a0514] hover:bg-white/5 border border-dashed border-white/10 rounded-lg text-sm text-gray-400 hover:text-[#44f80c] transition-colors">
                      <Plus className="w-4 h-4" /> Add Packaging Variant
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-5 border-t border-white/10 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 rounded-lg text-sm text-gray-300">Cancel</button>
              {activeTab === 'details' && (
                <button onClick={handleSave} className="px-4 py-2.5 bg-[#9a02d0] hover:bg-[#7a01a8] rounded-lg text-sm text-white">
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              )}
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
