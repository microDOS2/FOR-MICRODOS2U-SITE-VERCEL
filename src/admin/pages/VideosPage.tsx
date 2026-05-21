import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Pencil, Trash2, X, Save, Loader2, GripVertical, Video } from 'lucide-react';
import { toast } from 'sonner';

interface Video {
  id: string;
  title: string;
  description: string;
  youtube_id: string;
  sort_order: number;
  active: boolean;
  section: string;
  created_at: string;
}

export function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formYoutubeId, setFormYoutubeId] = useState('');
  const [formOrder, setFormOrder] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      toast.error('Failed to load videos: ' + error.message);
    } else {
      setVideos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchVideos(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDesc('');
    setFormYoutubeId('');
    setFormOrder(videos.length + 1);
    setFormActive(true);
    setShowForm(false);
  };

  const openAdd = () => {
    resetForm();
    setFormOrder(videos.length + 1);
    setShowForm(true);
  };

  const openEdit = (v: Video) => {
    setEditingId(v.id);
    setFormTitle(v.title);
    setFormDesc(v.description);
    setFormYoutubeId(v.youtube_id);
    setFormOrder(v.sort_order);
    setFormActive(v.active);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formYoutubeId.trim()) {
      toast.error('YouTube ID is required');
      return;
    }
    // Extract just the ID if they pasted a full URL
    let ytId = formYoutubeId.trim();
    const urlMatch = ytId.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (urlMatch) ytId = urlMatch[1];

    if (!/^[a-zA-Z0-9_-]{11}$/.test(ytId)) {
      toast.error('Invalid YouTube ID. Use the 11-character video ID or paste the full URL.');
      return;
    }

    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from('videos').update({
        title: formTitle.trim(),
        description: formDesc.trim(),
        youtube_id: ytId,
        sort_order: formOrder,
        active: formActive,
      }).eq('id', editingId);
      if (error) toast.error('Update failed: ' + error.message);
      else { toast.success('Video updated'); resetForm(); fetchVideos(); }
    } else {
      const { error } = await supabase.from('videos').insert({
        title: formTitle.trim(),
        description: formDesc.trim(),
        youtube_id: ytId,
        sort_order: formOrder,
        active: formActive,
        section: 'landing',
      });
      if (error) toast.error('Add failed: ' + error.message);
      else { toast.success('Video added'); resetForm(); fetchVideos(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this video?')) return;
    setDeletingId(id);
    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (error) toast.error('Delete failed: ' + error.message);
    else { toast.success('Video removed'); fetchVideos(); }
    setDeletingId(null);
  };

  const handleToggleActive = async (v: Video) => {
    const { error } = await supabase.from('videos').update({ active: !v.active }).eq('id', v.id);
    if (error) toast.error('Toggle failed: ' + error.message);
    else { toast.success(v.active ? 'Video hidden' : 'Video shown'); fetchVideos(); }
  };

  const filtered = videos.filter(v =>
    !search || v.title.toLowerCase().includes(search.toLowerCase()) ||
    v.youtube_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Landing Page Videos</h2>
          <p className="text-gray-400 text-sm">Manage the YouTube videos that play on the home page</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openAdd} className="bg-[#44f80c] hover:bg-[#3ad80a] text-black">
            <Plus className="w-4 h-4 mr-2" /> Add Video
          </Button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="bg-[#150f24] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-[#9a02d0]" />
              {editingId ? 'Edit Video' : 'Add Video'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Title</label>
                <Input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Video title"
                  className="bg-[#0a0514] border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">YouTube ID <span className="text-red-400">*</span></label>
                <Input
                  value={formYoutubeId}
                  onChange={e => setFormYoutubeId(e.target.value)}
                  placeholder="MLDChN3C1bI or paste full URL"
                  className="bg-[#0a0514] border-white/10 text-white"
                />
                <p className="text-gray-600 text-xs">The 11-character code from the YouTube URL, or paste the full URL</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Sort Order</label>
                <Input
                  type="number"
                  value={formOrder}
                  onChange={e => setFormOrder(parseInt(e.target.value) || 0)}
                  className="bg-[#0a0514] border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Status</label>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setFormActive(!formActive)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      formActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {formActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Description</label>
              <Input
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Optional description"
                className="bg-[#0a0514] border-white/10 text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="bg-[#44f80c] hover:bg-[#3ad80a] text-black">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
              <Button onClick={resetForm} variant="outline" className="border-white/10 text-gray-300 hover:text-white">
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video List */}
      <Card className="bg-[#150f24] border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search videos..."
              className="bg-[#0a0514] border-white/10 text-white max-w-sm"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {search ? 'No videos match your search' : 'No videos. Click "Add Video" to get started.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(v => (
                <div
                  key={v.id}
                  className="flex items-center gap-4 p-4 bg-[#0a0514] rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                >
                  <GripVertical className="w-4 h-4 text-gray-600 shrink-0" />
                  <div className="w-16 h-12 rounded bg-[#150f24] overflow-hidden shrink-0">
                    <img
                      src={`https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`}
                      alt={v.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium truncate">{v.title || 'Untitled'}</span>
                      <Badge
                        className={v.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggleActive(v)}
                      >
                        {v.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">ID: {v.youtube_id} | Order: {v.sort_order}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button onClick={() => openEdit(v)} size="sm" className="bg-white/5 hover:bg-white/10 text-white" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(v.id)}
                      size="sm"
                      className="bg-white/5 hover:bg-red-500/20 text-white hover:text-red-400"
                      disabled={deletingId === v.id}
                      title="Delete"
                    >
                      {deletingId === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
