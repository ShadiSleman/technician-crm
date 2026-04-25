/** מזהה ויזואלי (לוגו רחב) — ‎public/truecaller-logo.svg‎ ‎(יחס ‎120:32) */
export function TruecallerLogoMark({
  className = '',
  /** גובה בסיסי כשלא מועברים width/height — יחס רוחב נשמר */
  size = 28,
  width,
  height,
}: {
  className?: string
  size?: number
  width?: number
  height?: number
}) {
  const src = `${import.meta.env.BASE_URL}truecaller-logo.svg`
  let w: number
  let h: number
  if (width != null && height != null) {
    w = width
    h = height
  } else if (width != null) {
    w = width
    h = height ?? Math.round((width * 32) / 120)
  } else if (height != null) {
    h = height
    w = Math.round((height * 120) / 32)
  } else {
    h = size
    w = Math.round((size * 120) / 32)
  }
  return (
    <img
      src={src}
      alt=""
      className={className}
      width={w}
      height={h}
      decoding="async"
    />
  )
}
