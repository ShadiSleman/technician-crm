type TabId =
  | 'dashboard'
  | 'customers'
  | 'pricelist'
  | 'quotes'
  | 'billing'
  | 'calendar'
  | 'insights'
  | 'backup'

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function TabNavIcon({ id }: { id: TabId }) {
  switch (id) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" aria-hidden width={20} height={20} {...stroke}>
          <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
        </svg>
      )
    case 'customers':
      return (
        <svg viewBox="0 0 24 24" aria-hidden width={20} height={20} {...stroke}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'pricelist':
      return (
        <svg viewBox="0 0 24 24" aria-hidden width={20} height={20} {...stroke}>
          <path d="M8 6h13M8 12h13M8 18h9" />
        </svg>
      )
    case 'quotes':
      return (
        <svg viewBox="0 0 24 24" aria-hidden width={20} height={20} {...stroke}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      )
    case 'billing':
      return (
        <svg viewBox="0 0 24 24" aria-hidden width={20} height={20} {...stroke}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden width={20} height={20} {...stroke}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      )
    case 'insights':
      return (
        <svg viewBox="0 0 24 24" aria-hidden width={20} height={20} {...stroke}>
          <path d="M3 20h18" strokeWidth={1.5} />
          <path d="M7 20v-8" />
          <path d="M12 20V8" />
          <path d="M17 20v-5" />
        </svg>
      )
    case 'backup':
      return (
        <svg viewBox="0 0 24 24" aria-hidden width={20} height={20} {...stroke}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
      )
  }
}
