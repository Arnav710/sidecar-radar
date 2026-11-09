// A small set of line icons (24px grid, currentColor), so buttons can be icons
// instead of emoji. Decorative: always pair them with text or an aria-label.

type IconProps = { className?: string; size?: number };

function Svg({ children, size = 18, className, fill = "none" }: IconProps & { children: React.ReactNode; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconPeople = (p: IconProps) => <Svg {...p}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19a6 6 0 0 1 12 0M14 19a4.5 4.5 0 0 1 7-3.7" /></Svg>;
export const IconHome = (p: IconProps) => <Svg {...p}><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></Svg>;
export const IconCalendar = (p: IconProps) => <Svg {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></Svg>;
export const IconBook = (p: IconProps) => <Svg {...p}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></Svg>;
export const IconStar = (p: IconProps & { filled?: boolean }) => <Svg {...p} fill={p.filled ? "currentColor" : "none"}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" /></Svg>;
export const IconBookmark = (p: IconProps & { filled?: boolean }) => <Svg {...p} fill={p.filled ? "currentColor" : "none"}><path d="M6 4h12v17l-6-4-6 4z" /></Svg>;
export const IconPencil = (p: IconProps) => <Svg {...p}><path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z" /></Svg>;
export const IconQr = (p: IconProps) => <Svg {...p}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h3v3M20 14v.01M14 20h3M20 17v3" /></Svg>;
export const IconRefresh = (p: IconProps) => <Svg {...p}><path d="M20 11a8 8 0 0 0-14-4M4 5v3h3M4 13a8 8 0 0 0 14 4M20 19v-3h-3" /></Svg>;
export const IconPlus = (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconX = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IconCheck = (p: IconProps) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const IconArrowLeft = (p: IconProps) => <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>;
export const IconSparkle = (p: IconProps) => <Svg {...p}><path d="M12 4l1.8 4.7L18.5 10.5l-4.7 1.8L12 17l-1.8-4.7L5.5 10.5l4.7-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" /></Svg>;
export const IconFolder = (p: IconProps) => <Svg {...p}><path d="M3.5 7a2 2 0 0 1 2-2H10l2 2.5h6.5a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></Svg>;
export const IconDownload = (p: IconProps) => <Svg {...p}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></Svg>;
export const IconClock = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const IconSend = (p: IconProps) => <Svg {...p}><path d="M5 12l15-7-5 15-3-6z" /></Svg>;
export const IconSwap = (p: IconProps) => <Svg {...p}><path d="M5 8h13l-3-3M19 16H6l3 3" /></Svg>;
export const IconMic = (p: IconProps) => <Svg {...p}><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" /></Svg>;
export const IconLink = (p: IconProps) => <Svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" /></Svg>;
export const IconTrash = (p: IconProps) => <Svg {...p}><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></Svg>;
export const IconUser = (p: IconProps) => <Svg {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></Svg>;
