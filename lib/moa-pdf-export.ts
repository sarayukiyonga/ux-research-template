import type { jsPDF } from 'jspdf'
import type { MoaPdfRoute } from '@/lib/moa-pdf-routes'

export type { MoaPdfRoute } from '@/lib/moa-pdf-routes'

const SIDE_MM = 10
const BOTTOM_MM = 10

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  options: { title?: string; startNewPage: boolean }
) {
  const imgData = canvas.toDataURL('image/png', 0.92)
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  let topStart = BOTTOM_MM
  if (options.title) {
    if (options.startNewPage) {
      pdf.addPage()
    }
    pdf.setFontSize(11)
    pdf.setTextColor(40, 40, 40)
    const lines = pdf.splitTextToSize(options.title, pageW - 2 * SIDE_MM)
    pdf.text(lines, SIDE_MM, 12)
    topStart = 12 + (Array.isArray(lines) ? lines.length : 1) * 5 + 4
  } else if (options.startNewPage) {
    pdf.addPage()
  }

  const imgW = pageW - 2 * SIDE_MM
  const imgH = (canvas.height * imgW) / canvas.width
  const firstSlice = pageH - topStart - BOTTOM_MM
  const restSlice = pageH - 2 * BOTTOM_MM

  let heightLeft = imgH
  let y = topStart

  pdf.addImage(imgData, 'PNG', SIDE_MM, y, imgW, imgH)
  heightLeft -= firstSlice

  while (heightLeft > 0) {
    y = BOTTOM_MM - (imgH - heightLeft)
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', SIDE_MM, y, imgW, imgH)
    heightLeft -= restSlice
  }
}

export async function exportElementToPdf(element: HTMLElement, fileName: string) {
  const html2canvas = (await import('html2canvas')).default
  const { jsPDF } = await import('jspdf')

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: Math.max(element.scrollHeight, element.clientHeight),
  })

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  addCanvasToPdf(pdf, canvas, { startNewPage: false })
  const name = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`
  pdf.save(name)
}

export async function exportSelectorToPdf(selector: string, fileName: string) {
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) {
    throw new Error(`No se encontró el elemento: ${selector}`)
  }
  await exportElementToPdf(el, fileName)
}

export async function exportRoutesToCombinedPdf(
  routes: MoaPdfRoute[],
  fileName: string,
  options?: { settleMs?: number; scale?: number }
) {
  const html2canvas = (await import('html2canvas')).default
  const { jsPDF } = await import('jspdf')

  const settleMs = options?.settleMs ?? 2200
  const scale = options?.scale ?? 1.35
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const host = document.createElement('div')
  host.setAttribute('data-html2canvas-ignore', 'true')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1280px;height:960px;overflow:auto;opacity:0.02;pointer-events:none;z-index:-1;'

  document.body.appendChild(host)

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  let first = true

  try {
    for (const route of routes) {
      const iframe = document.createElement('iframe')
      iframe.setAttribute('data-html2canvas-ignore', 'true')
      iframe.style.cssText = 'width:1200px;min-height:720px;border:0;display:block;'
      iframe.src = `${origin}${route.path.startsWith('/') ? route.path : `/${route.path}`}`
      host.appendChild(iframe)

      await new Promise<void>((resolve, reject) => {
        let maxWait = window.setTimeout(() => {
          window.setTimeout(resolve, settleMs)
        }, 20000)
        iframe.onload = () => {
          window.clearTimeout(maxWait)
          window.setTimeout(resolve, settleMs)
        }
        iframe.onerror = () => {
          window.clearTimeout(maxWait)
          reject(new Error(`No se pudo cargar ${route.path}`))
        }
      })

      const doc = iframe.contentDocument
      const win = iframe.contentWindow
      const root =
        (doc?.getElementById('moa-pdf-root') as HTMLElement | null) ??
        (doc?.body as HTMLElement | null)

      if (!root || !doc) {
        host.removeChild(iframe)
        continue
      }

      const prevY = win?.scrollY ?? 0
      win?.scrollTo(0, 0)

      const canvas = await html2canvas(root, {
        scale,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: doc.documentElement.scrollWidth,
        windowHeight: Math.max(root.scrollHeight, root.clientHeight),
      })

      win?.scrollTo(0, prevY)

      addCanvasToPdf(pdf, canvas, { title: route.title, startNewPage: !first })
      first = false
      host.removeChild(iframe)
    }
  } finally {
    document.body.removeChild(host)
  }

  const name = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`
  pdf.save(name)
}
