import { EmpathyTabbedView } from '@/components/EmpathyTabbedView'
import { CLIENT_PDF_BASENAME, PDF_CAPTURE_ROOT_ID } from '@/lib/client-config'

export default function EmpathyPage() {
  return (
    <EmpathyTabbedView
      pdfFileName={`${CLIENT_PDF_BASENAME}-mapa-empatia.pdf`}
      pdfRootId={PDF_CAPTURE_ROOT_ID}
    />
  )
}
