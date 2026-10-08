'use client'

// App-wide icon set: Phosphor icons exposed under the names the app already
// uses, so call sites keep the familiar <Flame size={12} className=… /> shape.
// Per-icon imports keep bundles small (no 1,500-icon barrel).
import { forwardRef } from 'react'
import type { Icon as PhosphorIcon, IconProps, IconWeight } from '@phosphor-icons/react/dist/lib/types'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { BellIcon } from '@phosphor-icons/react/dist/csr/Bell'
import { BookmarkSimpleIcon } from '@phosphor-icons/react/dist/csr/BookmarkSimple'
import { BookmarksSimpleIcon } from '@phosphor-icons/react/dist/csr/BookmarksSimple'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { CaretUpIcon } from '@phosphor-icons/react/dist/csr/CaretUp'
import { ChartBarIcon } from '@phosphor-icons/react/dist/csr/ChartBar'
import { ChatCircleIcon } from '@phosphor-icons/react/dist/csr/ChatCircle'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock'
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise'
import { CoinsIcon } from '@phosphor-icons/react/dist/csr/Coins'
import { CompassIcon } from '@phosphor-icons/react/dist/csr/Compass'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { CrownIcon } from '@phosphor-icons/react/dist/csr/Crown'
import { DeviceMobileIcon } from '@phosphor-icons/react/dist/csr/DeviceMobile'
import { DotsSixVerticalIcon } from '@phosphor-icons/react/dist/csr/DotsSixVertical'
import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/csr/DownloadSimple'
import { EnvelopeIcon } from '@phosphor-icons/react/dist/csr/Envelope'
import { EnvelopeSimpleOpenIcon } from '@phosphor-icons/react/dist/csr/EnvelopeSimpleOpen'
import { EyeIcon } from '@phosphor-icons/react/dist/csr/Eye'
import { EyeSlashIcon } from '@phosphor-icons/react/dist/csr/EyeSlash'
import { FileTextIcon } from '@phosphor-icons/react/dist/csr/FileText'
import { FilmSlateIcon } from '@phosphor-icons/react/dist/csr/FilmSlate'
import { FireIcon } from '@phosphor-icons/react/dist/csr/Fire'
import { FloppyDiskIcon } from '@phosphor-icons/react/dist/csr/FloppyDisk'
import { GearSixIcon } from '@phosphor-icons/react/dist/csr/GearSix'
import { GiftIcon } from '@phosphor-icons/react/dist/csr/Gift'
import { GlobeIcon } from '@phosphor-icons/react/dist/csr/Globe'
import { HeartIcon } from '@phosphor-icons/react/dist/csr/Heart'
import { HouseIcon } from '@phosphor-icons/react/dist/csr/House'
import { ImageSquareIcon } from '@phosphor-icons/react/dist/csr/ImageSquare'
import { InfoIcon } from '@phosphor-icons/react/dist/csr/Info'
import { LinkSimpleIcon } from '@phosphor-icons/react/dist/csr/LinkSimple'
import { ListIcon } from '@phosphor-icons/react/dist/csr/List'
import { LockIcon } from '@phosphor-icons/react/dist/csr/Lock'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { MinusIcon } from '@phosphor-icons/react/dist/csr/Minus'
import { MonitorIcon } from '@phosphor-icons/react/dist/csr/Monitor'
import { PaperPlaneRightIcon } from '@phosphor-icons/react/dist/csr/PaperPlaneRight'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { PhoneIcon } from '@phosphor-icons/react/dist/csr/Phone'
import { PlayIcon } from '@phosphor-icons/react/dist/csr/Play'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { ProhibitIcon } from '@phosphor-icons/react/dist/csr/Prohibit'
import { QuestionIcon } from '@phosphor-icons/react/dist/csr/Question'
import { ReceiptIcon } from '@phosphor-icons/react/dist/csr/Receipt'
import { ShareNetworkIcon } from '@phosphor-icons/react/dist/csr/ShareNetwork'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { SignInIcon } from '@phosphor-icons/react/dist/csr/SignIn'
import { SignOutIcon } from '@phosphor-icons/react/dist/csr/SignOut'
import { SparkleIcon } from '@phosphor-icons/react/dist/csr/Sparkle'
import { SquaresFourIcon } from '@phosphor-icons/react/dist/csr/SquaresFour'
import { StarIcon } from '@phosphor-icons/react/dist/csr/Star'
import { TagIcon } from '@phosphor-icons/react/dist/csr/Tag'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { TrendUpIcon } from '@phosphor-icons/react/dist/csr/TrendUp'
import { UploadSimpleIcon } from '@phosphor-icons/react/dist/csr/UploadSimple'
import { UserIcon } from '@phosphor-icons/react/dist/csr/User'
import { UsersIcon } from '@phosphor-icons/react/dist/csr/Users'
import { WarningIcon } from '@phosphor-icons/react/dist/csr/Warning'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'

export type { IconWeight }
export interface AppIconProps extends Omit<IconProps, 'fill' | 'ref'> {
  /** Any non-'none' fill switches to the solid weight; a colour also tints it */
  fill?: string
}
export type AppIcon = React.ForwardRefExoticComponent<AppIconProps & React.RefAttributes<SVGSVGElement>>

function make(Ph: PhosphorIcon, name: string): AppIcon {
  const C = forwardRef<SVGSVGElement, AppIconProps>(function AppIcon({ fill, weight, size = 24, color, className, ...rest }, ref) {
    const solid = (fill && fill !== 'none') || /(^|\s)fill-/.test(className ?? '')
    // Bold at small sizes reads crisper on dark UI; regular for larger glyphs
    const w: IconWeight = weight ?? (solid ? 'fill' : Number(size) <= 18 ? 'bold' : 'regular')
    const tint = color ?? (fill && fill !== 'none' && fill !== 'currentColor' ? fill : undefined)
    return <Ph ref={ref} size={size} weight={w} color={tint} className={className} {...rest} />
  })
  C.displayName = name
  return C
}

export const AlertCircle = make(WarningCircleIcon, 'AlertCircle')
export const AlertTriangle = make(WarningIcon, 'AlertTriangle')
export const ArrowLeft = make(ArrowLeftIcon, 'ArrowLeft')
export const ArrowRight = make(ArrowRightIcon, 'ArrowRight')
export const Ban = make(ProhibitIcon, 'Ban')
export const BarChart3 = make(ChartBarIcon, 'BarChart3')
export const Bell = make(BellIcon, 'Bell')
export const BookMarked = make(BookmarksSimpleIcon, 'BookMarked')
export const Bookmark = make(BookmarkSimpleIcon, 'Bookmark')
export const BookmarkPlus = make(BookmarkSimpleIcon, 'BookmarkPlus')
export const Check = make(CheckIcon, 'Check')
export const CheckCircle = make(CheckCircleIcon, 'CheckCircle')
export const CheckCircle2 = make(CheckCircleIcon, 'CheckCircle2')
export const ChevronDown = make(CaretDownIcon, 'ChevronDown')
export const ChevronLeft = make(CaretLeftIcon, 'ChevronLeft')
export const ChevronRight = make(CaretRightIcon, 'ChevronRight')
export const ChevronUp = make(CaretUpIcon, 'ChevronUp')
export const Clock = make(ClockIcon, 'Clock')
export const Coins = make(CoinsIcon, 'Coins')
export const Compass = make(CompassIcon, 'Compass')
export const Copy = make(CopyIcon, 'Copy')
export const Crown = make(CrownIcon, 'Crown')
export const Download = make(DownloadSimpleIcon, 'Download')
export const Edit = make(PencilSimpleIcon, 'Edit')
export const Eye = make(EyeIcon, 'Eye')
export const EyeOff = make(EyeSlashIcon, 'EyeOff')
export const FileText = make(FileTextIcon, 'FileText')
export const Film = make(FilmSlateIcon, 'Film')
export const Flame = make(FireIcon, 'Flame')
export const Gift = make(GiftIcon, 'Gift')
export const Globe = make(GlobeIcon, 'Globe')
export const GripVertical = make(DotsSixVerticalIcon, 'GripVertical')
export const Heart = make(HeartIcon, 'Heart')
export const HelpCircle = make(QuestionIcon, 'HelpCircle')
export const History = make(ClockCounterClockwiseIcon, 'History')
export const Home = make(HouseIcon, 'Home')
export const ImagePlus = make(ImageSquareIcon, 'ImagePlus')
export const Info = make(InfoIcon, 'Info')
export const LayoutDashboard = make(SquaresFourIcon, 'LayoutDashboard')
export const Link2 = make(LinkSimpleIcon, 'Link2')
export const Loader2 = make(CircleNotchIcon, 'Loader2')
export const Lock = make(LockIcon, 'Lock')
export const LogIn = make(SignInIcon, 'LogIn')
export const LogOut = make(SignOutIcon, 'LogOut')
export const Mail = make(EnvelopeIcon, 'Mail')
export const MailCheck = make(EnvelopeSimpleOpenIcon, 'MailCheck')
export const Menu = make(ListIcon, 'Menu')
export const MessageCircle = make(ChatCircleIcon, 'MessageCircle')
export const Minus = make(MinusIcon, 'Minus')
export const Monitor = make(MonitorIcon, 'Monitor')
export const Phone = make(PhoneIcon, 'Phone')
export const Play = make(PlayIcon, 'Play')
export const Plus = make(PlusIcon, 'Plus')
export const Receipt = make(ReceiptIcon, 'Receipt')
export const RotateCcw = make(ArrowCounterClockwiseIcon, 'RotateCcw')
export const Save = make(FloppyDiskIcon, 'Save')
export const Search = make(MagnifyingGlassIcon, 'Search')
export const Send = make(PaperPlaneRightIcon, 'Send')
export const Settings = make(GearSixIcon, 'Settings')
export const Share2 = make(ShareNetworkIcon, 'Share2')
export const Shield = make(ShieldCheckIcon, 'Shield')
export const Smartphone = make(DeviceMobileIcon, 'Smartphone')
export const Sparkles = make(SparkleIcon, 'Sparkles')
export const Star = make(StarIcon, 'Star')
export const Tag = make(TagIcon, 'Tag')
export const Trash2 = make(TrashIcon, 'Trash2')
export const TrendingUp = make(TrendUpIcon, 'TrendingUp')
export const Upload = make(UploadSimpleIcon, 'Upload')
export const User = make(UserIcon, 'User')
export const Users = make(UsersIcon, 'Users')
export const X = make(XIcon, 'X')
