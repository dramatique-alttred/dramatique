import type { ManualInstall } from '@/store/pwaStore'
import { ShareIOS, PlusSquare } from '@/components/ui/icons'

const icon = 'inline -mt-0.5 text-white'

/** How to add the app by hand on browsers that have no install button */
export default function InstallSteps({ kind }: { kind: NonNullable<ManualInstall> }) {
  if (kind === 'mac-safari') {
    return (
      <>In the menu bar choose <span className="text-white">File → Add to Dock</span> (Safari 17 or later).</>
    )
  }
  return (
    <>
      Tap <ShareIOS size={14} className={icon} />{' '}
      {kind === 'ios-other' ? 'in the address bar, ' : ''}then{' '}
      <span className="text-white whitespace-nowrap">Add to Home Screen <PlusSquare size={14} className={icon} /></span>
    </>
  )
}
