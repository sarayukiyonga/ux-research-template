import { InsightsTabbedView } from '@/components/InsightsTabbedView'
import { CLIENT_PDF_BASENAME, PDF_CAPTURE_ROOT_ID } from '@/lib/client-config'

export default function InsightsPage() {
  return (
    <InsightsTabbedView
      pdfFileName={`${CLIENT_PDF_BASENAME}-insights.pdf`}
      pdfRootId={PDF_CAPTURE_ROOT_ID}
    />
  )
}
