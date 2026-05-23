import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, Loader2, Upload, Play, X, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Video {
  id: string;
  title: string;
  description: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  sort_order: number;
  active: boolean;
  section: string;
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchVideos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .rpc('get_all_videos');
    if (error) toast.error('Failed to load videos: ' + error.message);
    else setVideos((data || []).sort((a: Video, b: Video) => a.sort_order - b.sort_order));
    setLoading(false);
  };

  useEffect(() => { fetchVideos(); }, []);

  // Close preview on unmount
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from('videos').getPublicUrl(path);
    return data?.publicUrl || '';
  };

  const ensureBucket = async () => {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === 'videos');
    if (!exists) {
      const { error } = await supabase.storage.createBucket('videos', {
        public: true,
        fileSizeLimit: 52428800, // 50MB — Supabase free tier max per file
      });
      if (error) throw error;
    } else {
      // Update existing bucket to ensure limit is set
      await supabase.storage.updateBucket('videos', {
        public: true,
        fileSizeLimit: 52428800,
      })
    }
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.type.startsWith('video/')) {
      toast.error('Please upload a video file (MP4, WebM, etc.)');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large. Maximum is 50MB per file.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      await ensureBucket();

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `landing/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const nextOrder = videos.length > 0 ? Math.max(...videos.map(v => v.sort_order)) + 1 : 1;

      const { error: dbError } = await supabase.rpc('insert_video', {
        p_title: file.name.replace(/\.[^/.]+$/, ''),
        p_description: '',
        p_storage_path: path,
        p_file_size: file.size,
        p_mime_type: file.type,
        p_sort_order: nextOrder,
        p_active: true,
        p_section: 'landing',
      });

      if (dbError) throw dbError;

      toast.success(`"${file.name}" uploaded successfully`);
      fetchVideos();
    } catch (err: any) {
      toast.error('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [videos]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDelete = async (v: Video) => {
    if (!confirm(`Delete "${v.title || v.storage_path}"?`)) return;
    setDeletingId(v.id);

    // Delete from storage
    await supabase.storage
      .from('videos')
      .remove([v.storage_path])

    // Delete from database
    const { error: dbError } = await supabase.rpc('delete_video_record', { p_id: v.id });
    if (dbError) toast.error('Delete failed: ' + dbError.message);
    else { toast.success('Video deleted'); fetchVideos(); }

    setDeletingId(null);
  };

  const handleToggleActive = async (v: Video) => {
    const { error } = await supabase.rpc('toggle_video_active', { p_id: v.id });
    if (error) toast.error('Toggle failed: ' + error.message);
    else { toast.success(v.active ? 'Video hidden' : 'Video shown'); fetchVideos(); }
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const idx = videos.findIndex(v => v.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= videos.length) return;

    const newVideos = [...videos];
    const temp = newVideos[idx].sort_order;
    newVideos[idx].sort_order = newVideos[swapIdx].sort_order;
    newVideos[swapIdx].sort_order = temp;

    await supabase.rpc('update_video_order', { p_id: newVideos[idx].id, p_order: newVideos[idx].sort_order });
    await supabase.rpc('update_video_order', { p_id: newVideos[swapIdx].id, p_order: newVideos[swapIdx].sort_order });

    setVideos(newVideos.sort((a, b) => a.sort_order - b.sort_order));
  };

  const handleUpdateTitle = async (id: string, title: string) => {
    const { error } = await supabase.rpc('update_video_title', { p_id: id, p_title: title });
    if (error) toast.error('Update failed: ' + error.message);
    else fetchVideos();
  };

  const openPreview = (v: Video) => {
    setPreviewId(v.id);
    setPreviewUrl(getPublicUrl(v.storage_path));
  };

  const closePreview = () => {
    setPreviewId(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
  };

  const filtered = videos.filter(v =>
    !search || v.title.toLowerCase().includes(search.toLowerCase()) ||
    v.storage_path.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Landing Page Videos</h2>
          <p className="text-gray-400 text-sm">Upload and manage self-hosted videos for the home page carousel</p>
        </div>
      </div>

      {/* Upload Drop Zone */}
      <Card className={`border-2 border-dashed mb-6 transition-colors ${
        dragOver ? 'border-[#9a02d0] bg-[#9a02d0]/5' : 'border-white/20 bg-[#150f24]'
      }`}>
        <CardContent className="p-8">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className="text-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className="space-y-3">
                <Loader2 className="w-10 h-10 animate-spin text-[#9a02d0] mx-auto" />
                <p className="text-white font-medium">Uploading...</p>
                <div className="w-full max-w-xs mx-auto bg-black/50 rounded-full h-2">
                  <div className="bg-gradient-to-r from-[#9a02d0] to-[#44f80c] h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#9a02d0]/20 flex items-center justify-center mx-auto">
                  <Upload className="w-7 h-7 text-[#9a02d0]" />
                </div>
                <p className="text-white font-medium text-lg">Drag & drop a video here</p>
                <p className="text-gray-500 text-sm">or click to browse. MP4, WebM, MOV up to 100MB</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
            <span className="text-gray-500 text-sm ml-auto">{videos.filter(v => v.active).length} active / {videos.length} total</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#9a02d0]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {search ? 'No videos match your search' : 'No videos uploaded yet. Drag & drop a file above to get started.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((v, idx) => (
                <div
                  key={v.id}
                  className="flex items-center gap-4 p-4 bg-[#0a0514] rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => handleMove(v.id, 'up')} disabled={idx === 0} className="text-gray-600 hover:text-white disabled:opacity-20">
                      <ChevronLeft className="w-4 h-4 rotate-90" />
                    </button>
                    <button onClick={() => handleMove(v.id, 'down')} disabled={idx === filtered.length - 1} className="text-gray-600 hover:text-white disabled:opacity-20">
                      <ChevronLeft className="w-4 h-4 -rotate-90" />
                    </button>
                  </div>

                  {/* Thumbnail / Play button */}
                  <button
                    onClick={() => openPreview(v)}
                    className="w-20 h-14 rounded bg-[#150f24] overflow-hidden shrink-0 flex items-center justify-center hover:ring-2 hover:ring-[#9a02d0] transition-all relative group"
                  >
                    <Play className="w-6 h-6 text-white/70 group-hover:text-white group-hover:scale-110 transition-all absolute" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Input
                        value={v.title}
                        onChange={e => handleUpdateTitle(v.id, e.target.value)}
                        onBlur={() => { /* saved on every change via handleUpdateTitle */ }}
                        className="bg-transparent border-transparent hover:border-white/10 focus:border-[#9a02d0] text-white font-medium px-1 py-0 h-auto text-sm w-full max-w-md"
                      />
                      <Badge
                        className={v.active ? 'bg-green-500/20 text-green-400 cursor-pointer' : 'bg-red-500/20 text-red-400 cursor-pointer'}
                        onClick={() => handleToggleActive(v)}
                      >
                        {v.active ? 'Active' : 'Hidden'}
                      </Badge>
                    </div>
                    <p className="text-gray-600 text-xs mt-1 truncate">
                      {v.storage_path} &middot; {formatBytes(v.file_size)} &middot; Order: {v.sort_order}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      onClick={() => handleDelete(v)}
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

      {/* Video Preview Modal */}
      {previewId && previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={closePreview}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={closePreview}
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <video
              src={previewUrl}
              controls
              autoPlay
              className="w-full rounded-lg bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
}
