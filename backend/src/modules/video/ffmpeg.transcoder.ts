import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

/**
 * Transcoder contract: raw video file in → multi-bitrate HLS folder out.
 * FFmpeg is the implementation today; AWS MediaConvert can implement the
 * same interface later without touching uploads, storage or playback.
 */
export interface TranscodeResult {
  masterPlaylist: string // relative to outDir, e.g. "master.m3u8"
  durationSeconds: number
  renditions: string[]
}

export interface Transcoder {
  transcode(input: string, outDir: string, onProgress: (percent: number) => void): Promise<TranscodeResult>
}

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg'
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe'

// Ladder keyed on the *short* side, so vertical 9:16 drama (1080x1920) and
// landscape both get sensible sizes. Bitrates tuned for mobile viewing.
const LADDER = [
  { name: '1080p', short: 1080, video: 4500, max: 4800 },
  { name: '720p', short: 720, video: 2500, max: 2700 },
  { name: '480p', short: 480, video: 1200, max: 1300 },
  { name: '360p', short: 360, video: 700, max: 750 },
]
const SEGMENT_SECONDS = 4

interface Probe { width: number; height: number; duration: number; hasAudio: boolean }

function run(cmd: string, args: string[], onStdout?: (chunk: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true })
    let out = ''
    let err = ''
    child.stdout.on('data', d => { out += d; onStdout?.(String(d)) })
    child.stderr.on('data', d => { err = (err + d).slice(-20000) })
    child.on('error', e => reject(new Error(`${cmd} could not start: ${e.message}`)))
    child.on('close', code => {
      if (code === 0) return resolve(out)
      // FFmpeg ends with harmless stats lines — surface the actual error lines
      const lines = err.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      const errors = lines.filter(l => /error|invalid|failed|cannot|unable|not found|no such/i.test(l))
      reject(new Error(`${path.basename(cmd)} exited ${code}: ${(errors.length ? errors : lines).slice(-4).join(' | ')}`))
    })
  })
}

export async function probe(file: string): Promise<Probe> {
  const json = JSON.parse(await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]))
  const video = json.streams?.find((s: any) => s.codec_type === 'video')
  if (!video) throw new Error('The file has no video track')
  // Phones record portrait video as landscape + a rotation flag
  const rotation = Math.abs(Number(video.side_data_list?.find((d: any) => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0))
  const swap = rotation === 90 || rotation === 270
  const declared = Number(json.format?.duration ?? video.duration)
  return {
    width: swap ? video.height : video.width,
    height: swap ? video.width : video.height,
    duration: declared > 0 ? declared : await lastFrameTime(file),
    hasAudio: json.streams.some((s: any) => s.codec_type === 'audio'),
  }
}

/**
 * Browser and screen recordings (MediaRecorder WebM) often have no duration
 * in the header. Reading packet timestamps is fast (no decoding) and gives
 * the time of the last frame instead.
 */
async function lastFrameTime(file: string): Promise<number> {
  const out = await run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', file])
  let last = 0
  for (const line of out.split(/\r?\n/)) {
    const t = parseFloat(line)
    if (t > last) last = t
  }
  return last
}

export const ffmpegTranscoder: Transcoder = {
  async transcode(input, outDir, onProgress) {
    const info = await probe(input)
    if (!info.duration) throw new Error('Could not read the video duration')

    const portrait = info.height >= info.width
    const sourceShort = Math.min(info.width, info.height)
    // Never upscale; always keep at least the smallest rendition
    const ladder = LADDER.filter(r => r.short <= sourceShort)
    const rungs = ladder.length ? ladder : [LADDER[LADDER.length - 1]]

    await Promise.all(rungs.map(r => mkdir(path.join(outDir, r.name), { recursive: true })))

    // Forward slashes even on Windows: FFmpeg writes these paths into the
    // master playlist, and players need URL-style "1080p/index.m3u8"
    const out = outDir.split(path.sep).join('/')
    const split = `[0:v]split=${rungs.length}${rungs.map((_, i) => `[s${i}]`).join('')}`
    const scales = rungs.map((r, i) => `[s${i}]scale=${portrait ? `${r.short}:-2` : `-2:${r.short}`}[v${i}]`)
    const args = [
      '-hide_banner', '-y', '-nostats', '-progress', 'pipe:1', '-i', input,
      '-filter_complex', [split, ...scales].join(';'),
      ...rungs.flatMap((_, i) => ['-map', `[v${i}]`]),
      ...(info.hasAudio ? rungs.flatMap(() => ['-map', '0:a:0']) : []),
      '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
      // Aligned keyframes every segment so the player can switch quality cleanly
      '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_SECONDS})`, '-sc_threshold', '0',
      ...rungs.flatMap((r, i) => [`-b:v:${i}`, `${r.video}k`, `-maxrate:v:${i}`, `${r.max}k`, `-bufsize:v:${i}`, `${r.max * 2}k`]),
      ...(info.hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : []),
      '-f', 'hls', '-hls_time', String(SEGMENT_SECONDS), '-hls_playlist_type', 'vod', '-hls_flags', 'independent_segments',
      '-hls_segment_filename', `${out}/%v/seg_%03d.ts`,
      '-master_pl_name', 'master.m3u8',
      '-var_stream_map', rungs.map((r, i) => (info.hasAudio ? `v:${i},a:${i},name:${r.name}` : `v:${i},name:${r.name}`)).join(' '),
      `${out}/%v/index.m3u8`,
    ]

    let last = -1
    await run(FFMPEG, args, chunk => {
      const m = /out_time_(?:us|ms)=(\d+)/.exec(chunk)
      if (!m) return
      const pct = Math.min(99, Math.floor((Number(m[1]) / 1e6 / info.duration) * 100))
      if (pct >= last + 5) { last = pct; onProgress(pct) } // throttle DB writes
    })

    return { masterPlaylist: 'master.m3u8', durationSeconds: Math.round(info.duration), renditions: rungs.map(r => r.name) }
  },
}
