'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/admin/AdminLayout'
import { AdminPageHeader, FormField, Input, Select, Toggle, AdminBtn, AdminCard, Breadcrumb } from '@/components/admin/AdminUI'
import { useAdminSeriesOne, useAdminEpisodes, adminKeys } from '@/hooks/admin/useAdminQueries'
import { adminEpisodeApi } from '@/lib/admin-api'
import { useQueryClient } from '@tanstack/react-query'
import { Save, Film, Loader2 } from 'lucide-react'

export default function AddEpisodePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: series, isLoading: seriesLoading } = useAdminSeriesOne(params.id)
  const { data: episodes = [] } = useAdminEpisodes(params.id)

  const [form, setForm] = useState({
    number: 1, title: '',
    is_free: false, coin_cost: 5, subtitles_url: '', publish_date: '',
  })
  // Follows the series lock point until the admin flips the toggle themselves
  const [freeTouched, setFreeTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Once real series + episodes load, default episode number to next-in-sequence
  useEffect(() => {
    if (series) {
      const number = episodes.length + 1
      setForm(f => ({ ...f, number, coin_cost: series.coin_cost_per_episode, is_free: number < series.lock_from_episode }))
    }
  }, [series, episodes.length])

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const created = await adminEpisodeApi.create(params.id, {
        number: form.number,
        title: form.title || `Episode ${form.number}`,
        is_free: form.is_free,
        coin_cost: form.is_free ? null : form.coin_cost,
        subtitles_url: form.subtitles_url || null,
        publish_date: form.publish_date || null,
      })
      qc.invalidateQueries({ queryKey: adminKeys.episodes(params.id) })
      qc.invalidateQueries({ queryKey: adminKeys.seriesOne(params.id) })
      // Uploads need the episode's id, so the uploader lives on its edit page
      router.push(`/admin/series/${params.id}/episodes/${created.id}`)
    } catch (err: any) {
      setError(err.message || 'Could not save episode. Try again.')
      setSaving(false)
    }
  }

  if (seriesLoading || !series) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-[#e8001d] border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <Breadcrumb items={[
        { label: 'Series', href: '/admin/series' },
        { label: series.title, href: `/admin/series/${params.id}` },
        { label: 'Episodes', href: `/admin/series/${params.id}/episodes` },
        { label: 'Add Episode' },
      ]} />
      <AdminPageHeader
        title="Add Episode"
        subtitle={series.title}
        action={
          <AdminBtn variant="primary" onClick={handleSave}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save & Upload Video'}
          </AdminBtn>
        }
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-5">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <AdminCard>
            <h3 className="text-white font-bold text-sm mb-4">Episode Details</h3>
            <div className="space-y-4">
              <FormField label="Episode Number" required><Input type="number" value={form.number} onChange={e => { const n = Number(e.target.value); setForm(f => ({ ...f, number: n, ...(!freeTouched && series && { is_free: n < series.lock_from_episode }) })) }} /></FormField>
              <FormField label="Title" required><Input value={form.title} onChange={e => set('title', e.target.value)} placeholder={`Episode ${form.number}`} /></FormField>
            </div>
          </AdminCard>

          <AdminCard>
            <h3 className="text-white font-bold text-sm mb-4">Video</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-[#0a0a0f] border border-[#24242f] rounded-xl p-4">
                <Film size={20} className="text-[#5a5a68] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#8b8b9a] leading-relaxed">
                  Save the episode and you'll go straight to its page to upload the video. Duration is measured from the video automatically.
                </p>
              </div>
              <FormField label="Subtitles URL" hint="Optional — WebVTT file"><Input value={form.subtitles_url} onChange={e => set('subtitles_url', e.target.value)} placeholder="https://..." /></FormField>
            </div>
          </AdminCard>
        </div>

        <div className="space-y-5">
          <AdminCard>
            <h3 className="text-white font-bold text-sm mb-4">Access</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="text-white text-sm font-medium">Free Episode</p><p className="text-[#5a5a68] text-xs">Overrides series lock</p></div>
                <Toggle on={form.is_free} onToggle={() => { setFreeTouched(true); set('is_free', !form.is_free) }} />
              </div>
              {!form.is_free && (
                <FormField label="Coin Cost" hint={`Series default: ${series.coin_cost_per_episode}`}><Input type="number" value={form.coin_cost} onChange={e => set('coin_cost', Number(e.target.value))} /></FormField>
              )}
            </div>
          </AdminCard>

          <AdminCard>
            <h3 className="text-white font-bold text-sm mb-4">Scheduling</h3>
            <FormField label="Publish Date" hint="Leave empty to publish now"><Input type="date" value={form.publish_date} onChange={e => set('publish_date', e.target.value)} /></FormField>
          </AdminCard>

          <AdminCard>
            <h3 className="text-white font-bold text-sm mb-3">Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[#8b8b9a]">Episode</span><span className="text-white">#{form.number}</span></div>
              <div className="flex justify-between"><span className="text-[#8b8b9a]">Access</span><span className={form.is_free ? 'text-emerald-400' : 'text-[#e8001d]'}>{form.is_free ? 'Free' : `${form.coin_cost} coins`}</span></div>
            </div>
          </AdminCard>
        </div>
      </div>
    </AdminLayout>
  )
}
