import { create } from 'zustand'

/** Chrome/Edge/Samsung Internet fire this before showing their own install UI */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaState {
  // Captured install event — null when the browser can't (or already did) install
  installEvent: BeforeInstallPromptEvent | null
  // Running as the installed app (home-screen launch)
  isStandalone: boolean
  // iPhone/iPad Safari: no install event, the user adds it from the Share sheet
  isIOS: boolean

  setInstallEvent: (e: BeforeInstallPromptEvent | null) => void
  setEnvironment: (env: { isStandalone: boolean; isIOS: boolean }) => void
  // Opens the browser's install dialog; resolves true if the user accepted
  install: () => Promise<boolean>
}

export const usePwaStore = create<PwaState>()((set, get) => ({
  installEvent: null,
  isStandalone: false,
  isIOS: false,

  setInstallEvent: (installEvent) => set({ installEvent }),
  setEnvironment: (env) => set(env),

  install: async () => {
    const e = get().installEvent
    if (!e) return false
    await e.prompt()
    const { outcome } = await e.userChoice
    // The event can only be used once either way
    set({ installEvent: null })
    return outcome === 'accepted'
  },
}))
