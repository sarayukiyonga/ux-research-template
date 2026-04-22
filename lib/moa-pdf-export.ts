import type { jsPDF } from 'jspdf'
import type { MoaPdfRoute } from '@/lib/moa-pdf-routes'
import { PDF_CAPTURE_ROOT_ID } from '@/lib/client-config'

export type { MoaPdfRoute } from '@/lib/moa-pdf-routes'

const SIDE_MM = 10
const BOTTOM_MM = 10
const PAGE_W_MM = 210
const PAGE_H_MM = 297
const IMG_W_MM = PAGE_W_MM - 2 * SIDE_MM   // 190 mm
const REST_SLICE_MM = PAGE_H_MM - 2 * BOTTOM_MM // 277 mm

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

/**
 * Inserta divs espaciadores invisibles antes de los elementos marcados con
 * [data-pdf-avoid-break] que se cortarían entre páginas PDF.
 * Devuelve los espaciadores para que el llamador los elimine tras el render.
 *
 * @param element  Elemento raíz que se va a capturar
 * @param domPxPerPage  Altura de una página PDF expresada en píxeles DOM
 */
function injectPageBreakAvoidance(
  element: HTMLElement,
  domPxPerPage: number
): HTMLElement[] {
  const spacers: HTMLElement[] = []
  const containerRect = element.getBoundingClientRect()

  const avoidEls = Array.from(
    element.querySelectorAll<HTMLElement>('[data-pdf-avoid-break]')
  )

  for (const el of avoidEls) {
    // getBoundingClientRect() fuerza un reflow, por lo que los espaciadores
    // previos ya están incluidos en la posición devuelta.
    const rect = el.getBoundingClientRect()
    const elH = rect.height

    // Ignorar elementos más altos que el 90 % de una página (no pueden evitar el corte)
    if (elH <= 0 || elH > domPxPerPage * 0.9) continue

    const elTop = rect.top - containerRect.top + element.scrollTop
    const elBottom = elTop + elH

    const topPage = Math.floor(elTop / domPxPerPage)
    const bottomPage = Math.floor(elBottom / domPxPerPage)

    if (topPage !== bottomPage) {
      // El elemento cruza un salto de página: calcular el espaciador necesario
      const spacerHeight = (topPage + 1) * domPxPerPage - elTop

      const spacer = document.createElement('div')
      spacer.style.cssText = `height:${spacerHeight}px;display:block;background:transparent;pointer-events:none;flex-shrink:0;`
      spacer.setAttribute('data-pdf-spacer', 'true')
      el.parentNode?.insertBefore(spacer, el)
      spacers.push(spacer)
    }
  }

  return spacers
}

/**
 * Oculta inputs, selects, textareas, botones y cualquier elemento marcado con
 * [data-pdf-ignore] en el clon del documento antes de que html2canvas lo renderice.
 * Excepción: los elementos con [data-pdf-show] se sustituyen por un <div> con el
 * mismo texto para que su contenido siga siendo visible en el PDF.
 * No modifica el DOM real de la página.
 */
function hideInteractiveElements(clonedDoc: Document) {
  // Primero: sustituir los textareas/inputs marcados con data-pdf-show por un div legible
  clonedDoc
    .querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
      'textarea[data-pdf-show], input[data-pdf-show]'
    )
    .forEach((el) => {
      const proxy = clonedDoc.createElement('div')
      proxy.textContent = el.value ?? ''
      // Heredar clases visuales del elemento original, excepto las de interactividad
      proxy.className = el.className
      proxy.style.cssText = 'white-space: pre-wrap; overflow: visible; height: auto; resize: none;'
      el.parentNode?.insertBefore(proxy, el)
    })

  // Después: ocultar todos los controles interactivos (incluidos los data-pdf-show ya sustituidos)
  const selector = [
    'input',
    'textarea',
    'select',
    'button',
    '[role="button"]',
    '[data-pdf-ignore]',
  ].join(',')

  clonedDoc.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.style.setProperty('display', 'none', 'important')
  })
}

export async function exportElementToPdf(element: HTMLElement, fileName: string) {
  // html2canvas-pro es un fork con soporte para oklch/oklab/lab/lch usados por Tailwind v4
  const html2canvas = (await import('html2canvas-pro')).default
  const { jsPDF } = await import('jspdf')

  // Píxeles DOM equivalentes a una página PDF (misma fórmula que addCanvasToPdf)
  const domPxPerPage = REST_SLICE_MM * element.scrollWidth / IMG_W_MM

  // Insertar espaciadores para evitar cortes; se eliminan tras el render
  const spacers = injectPageBreakAvoidance(element, domPxPerPage)

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: Math.max(element.scrollHeight, element.clientHeight),
    onclone: (_clonedDoc, clonedEl) => hideInteractiveElements(clonedEl.ownerDocument),
  })

  // Limpiar espaciadores del DOM real
  spacers.forEach((s) => s.parentNode?.removeChild(s))

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
  // html2canvas-pro es un fork con soporte para oklch/oklab/lab/lch usados por Tailwind v4
  const html2canvas = (await import('html2canvas-pro')).default
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
        const maxWait = window.setTimeout(() => {
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
        (doc?.getElementById(PDF_CAPTURE_ROOT_ID) as HTMLElement | null) ??
        (doc?.body as HTMLElement | null)

      if (!root || !doc) {
        host.removeChild(iframe)
        continue
      }

      const prevY = win?.scrollY ?? 0
      win?.scrollTo(0, 0)

      const domPxPerPage = REST_SLICE_MM * root.scrollWidth / IMG_W_MM
      const spacers = injectPageBreakAvoidance(root, domPxPerPage)

      const canvas = await html2canvas(root, {
        scale,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: doc.documentElement.scrollWidth,
        windowHeight: Math.max(root.scrollHeight, root.clientHeight),
        onclone: (_clonedDoc, clonedEl) => hideInteractiveElements(clonedEl.ownerDocument),
      })

      spacers.forEach((s) => s.parentNode?.removeChild(s))

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
