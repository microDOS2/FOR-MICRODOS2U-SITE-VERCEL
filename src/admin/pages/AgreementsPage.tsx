import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, downloadCSV } from '@/lib/utils'
import { Search, Download, Plus, Trash2, X, ChevronLeft, ChevronRight, FileSignature, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Agreement {
  id: string
  title: string
  content: string
  signee_name: string | null
  signee_email: string | null
  signature_data: string | null
  signed_at: string | null
  status: string
  created_at: string
}

export function AgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSignModal, setShowSignModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null)
  const [formData, setFormData] = useState({ title: '', content: '' })
  const [signeeName, setSigneeName] = useState('')
  const [signeeEmail, setSigneeEmail] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const pageSize = 10

  useEffect(() => { fetchAgreements() }, [page, search])

  const fetchAgreements = async () => {
    setLoading(true)
    let query = supabase.from('agreements').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1)
    if (search) query = query.or(`title.ilike.%${search}%,signee_name.ilike.%${search}%`)
    const { data, count, error } = await query
    if (error) console.error(error)
    else { setAgreements(data || []); setTotalCount(count || 0) }
    setLoading(false)
  }

  const handleCreate = async () => {
    const { error } = await supabase.from('agreements').insert([{ ...formData, status: 'pending' }])
    if (error) toast.error(error.message)
    setShowCreateModal(false); setFormData({ title: '', content: '' }); fetchAgreements()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agreement?')) return
    const { error } = await supabase.from('agreements').delete().eq('id', id)
    if (error) toast.error(error.message)
    else fetchAgreements()
  }

  const openSignModal = (agr: Agreement) => {
    setSelectedAgreement(agr)
    setSigneeName('')
    setSigneeEmail('')
    setShowSignModal(true)
    setTimeout(() => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.strokeStyle = '#000'
          ctx.lineWidth = 2
          ctx.lineCap = 'round'
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
    }, 100)
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.closePath()
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  const saveSignature = async () => {
    const canvas = canvasRef.current
    if (!canvas || !selectedAgreement) return
    const signatureData = canvas.toDataURL('image/png')

    const { error } = await supabase.from('agreements').update({
      signee_name: signeeName,
      signee_email: signeeEmail,
      signature_data: signatureData,
      signed_at: new Date().toISOString(),
      status: 'signed'
    }).eq('id', selectedAgreement.id)

    if (error) toast.error(error.message)
    else {
      setShowSignModal(false)
      fetchAgreements()
    }
  }

  const exportCSV = () => {
    downloadCSV('agreements', ['ID', 'Title', 'Signee', 'Email', 'Status', 'Signed At', 'Created'],
      agreements.map(a => [a.id, a.title, a.signee_name || '', a.signee_email || '', a.status, a.signed_at || '', a.created_at]))
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search agreements..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-10 pr-4 py-2.5 bg-[#150f24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#9a02d0] hover:bg-[#9a02d0] rounded-lg text-sm text-white transition-colors">
            <Plus className="w-4 h-4" /> New Agreement
          </button>
        </div>
      </div>

      <div className="bg-[#150f24] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Signee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Signed</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
              ) : agreements.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">No agreements found</td></tr>
              ) : agreements.map(a => (
                <tr key={a.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{a.title}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[300px]">{a.content.slice(0, 80)}...</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{a.signee_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium',
                      a.status === 'signed' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400')}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{a.signed_at ? formatDate(a.signed_at) : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setSelectedAgreement(a); setShowViewModal(true) }} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-[#44f80c]" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      {a.status !== 'signed' && (
                        <button onClick={() => openSignModal(a)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-purple-400" title="Sign">
                          <FileSignature className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">New Agreement</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Title</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Content</label>
                <textarea value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} rows={6} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-white/10">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 rounded-lg text-sm text-gray-300">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2.5 bg-[#9a02d0] hover:bg-[#9a02d0] rounded-lg text-sm text-white">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">{selectedAgreement.title}</h3>
              <button onClick={() => setShowViewModal(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-[#0a0514]/50 border border-white/10 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{selectedAgreement.content}</div>
              {selectedAgreement.signature_data && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Signature</label>
                  <img src={selectedAgreement.signature_data} alt="Signature" className="border border-white/10 rounded-lg bg-white" />
                  <p className="text-sm text-gray-400 mt-2">Signed by {selectedAgreement.signee_name} on {formatDate(selectedAgreement.signed_at!)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sign Modal */}
      {showSignModal && selectedAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#150f24] border border-white/10 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Sign Agreement</h3>
              <button onClick={() => setShowSignModal(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-[#0a0514]/50 border border-white/10 rounded-lg p-3 text-sm text-gray-300 max-h-32 overflow-y-auto">{selectedAgreement.content}</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Your Name</label>
                  <input type="text" value={signeeName} onChange={e => setSigneeName(e.target.value)} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Your Email</label>
                  <input type="email" value={signeeEmail} onChange={e => setSigneeEmail(e.target.value)} className="w-full px-3 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9a02d0]/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Signature</label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg bg-white overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={460}
                    height={150}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="cursor-crosshair"
                  />
                </div>
                <button onClick={clearSignature} className="mt-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">Clear signature</button>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-white/10">
              <button onClick={() => setShowSignModal(false)} className="px-4 py-2.5 bg-[#0a0514] hover:bg-white/5 rounded-lg text-sm text-gray-300">Cancel</button>
              <button onClick={saveSignature} className="px-4 py-2.5 bg-[#9a02d0] hover:bg-[#9a02d0] rounded-lg text-sm text-white">Sign Agreement</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
