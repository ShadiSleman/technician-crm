import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export function waitAnimationFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const step = () => {
      if (n <= 0) resolve()
      else {
        n--
        requestAnimationFrame(step)
      }
    }
    requestAnimationFrame(step)
  })
}

async function preloadImages(container: HTMLElement): Promise<void> {
  const imgs = [...container.querySelectorAll('img')]
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((res) => {
          if (img.complete && img.naturalHeight > 0) {
            res()
            return
          }
          img.onload = () => res()
          img.onerror = () => res()
        }),
    ),
  )
}

function blobToBase64Data(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const s = reader.result as string
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * מוסיף את הקנבס ל־PDF במקטעי עמודים — חיתוך פיקסלים (בלי הזזת תמונה שלמה),
 * כדי שלא יופיע קו/רווח אפור בין דף לדף.
 */
function addCanvasToPdfPages(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  margin: number,
  usableW: number,
  usableH: number,
): void {
  const fullHeightMm = (canvas.height * usableW) / canvas.width

  if (fullHeightMm <= usableH + 0.02) {
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const drawH = fullHeightMm
    const y = margin + Math.max(0, (usableH - drawH) / 2)
    pdf.addImage(imgData, 'JPEG', margin, y, usableW, drawH)
    return
  }

  const pxPerMm = canvas.height / fullHeightMm
  const slicePx = Math.max(1, Math.floor(usableH * pxPerMm))
  let yPx = 0
  let first = true

  while (yPx < canvas.height) {
    if (!first) pdf.addPage()
    first = false

    const hPx = Math.min(slicePx, canvas.height - yPx)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = hPx
    const ctx = slice.getContext('2d')
    if (!ctx) throw new Error('canvas 2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(
      canvas,
      0,
      yPx,
      canvas.width,
      hPx,
      0,
      0,
      canvas.width,
      hPx,
    )

    const sliceData = slice.toDataURL('image/jpeg', 0.95)
    const sliceMm = (hPx * usableW) / canvas.width
    pdf.addImage(sliceData, 'JPEG', margin, margin, usableW, sliceMm)

    yPx += hPx
  }
}

/** ממיר אלמנט (כמו גיליון הצעה מודפסת) ל־PDF — עברית נשמרת כתמונה */
export async function elementToPdfBlob(el: HTMLElement): Promise<Blob> {
  await preloadImages(el)
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    scrollX: 0,
    scrollY: 0,
  })

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 7
  const usableW = pageWidth - 2 * margin
  const usableH = pageHeight - 2 * margin

  addCanvasToPdfPages(pdf, canvas, margin, usableW, usableH)

  return pdf.output('blob')
}

/**
 * שיתוף / הורדת PDF: אנדרואיד — קובץ דרך Share; דפדפן — Web Share עם קובץ או הורדה.
 */
export async function shareOrDownloadPdf(
  blob: Blob,
  fileName: string,
  title: string,
): Promise<void> {
  const name = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`

  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = await blobToBase64Data(blob)
      const path = `quote-${Date.now()}.pdf`
      await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Cache,
      })
      const { uri } = await Filesystem.getUri({
        directory: Directory.Cache,
        path,
      })
      await Share.share({
        title,
        text: title,
        url: uri,
        dialogTitle: 'שיתוף PDF',
      })
      return
    } catch (e) {
      console.warn('shareOrDownloadPdf native', e)
    }
  }

  const file = new File([blob], name, { type: 'application/pdf' })
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      title,
      files: [file],
    })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
