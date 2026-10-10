import { create } from 'zustand'

/** Chrome/Edge/Samsung Internet fire this before showing their own install UI */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type ManualInstall = 'ios-safari' | 'ios-other' | 'mac-safari' | null

interface PwaState {
  // Captured install event — null when the browser can't (or already did) install
  installEvent: BeforeInstallPromptEvent | null
  // Running as the installed app (home-screen launch)
  isStandalone: boolean
  // Browsers with no install event, where the user adds the app by hand:
  // iOS (Safari or Chrome → Share → Add to Home Screen) and Mac Safari (File → Add to Dock)
  manualInstall: ManualInstall

  setInstallEvent: (e: BeforeInstallPromptEvent | null) => void
  setEnvironment: (env: { isStandalone: boolean; manualInstall: ManualInstall }) => void
  // Opens the browser's install dialog; resolves true if the user accepted
  install: () => Promise<boolean>
}

export const usePwaStore = create<PwaState>()((set, get) => ({
  installEvent: null,
  isStandalone: false,
  manualInstall: null,

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
