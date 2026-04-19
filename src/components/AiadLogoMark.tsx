/** לוגו רשמי — קובץ ב־public/aiad-logo.png (מסך והדפסה) */
export function AiadLogoMark({
  variant = 'screen',
}: {
  variant?: 'screen' | 'print'
}) {
  const src = `${import.meta.env.BASE_URL}aiad-logo.png`
  return (
    <img
      src={src}
      alt="איאד — מערכות קירור ומיזוג אוויר"
      className={`aiad-logo aiad-logo--${variant}`}
      decoding="async"
    />
  )
}
