/**
 * Guía para vincular la hoja de respuestas de encuesta (clientes actuales o potenciales).
 */
export function SurveySheetLinkHelp({ variant }: { variant: 'clientes' | 'potenciales' }) {
  const isClientes = variant === 'clientes'
  const envVar = isClientes ? 'SURVEY_SHEET_ID' : 'POTENTIAL_SURVEY_SHEET_ID'
  const range = isClientes ? 'A:P' : 'A:Q'
  const title = isClientes
    ? 'Cómo vincular la hoja de la encuesta (clientes actuales)'
    : 'Cómo vincular la hoja de la encuesta (clientes potenciales)'

  return (
    <div className="mt-6 max-w-xl mx-auto rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-5 text-left shadow-sm sm:px-5">
      <h2 className="text-sm font-semibold text-amber-950">{title}</h2>
      <p className="mt-2 text-xs text-amber-900/85 leading-relaxed">
        {isClientes ? (
          <>
            Esta pantalla lee las respuestas desde un <strong>documento de Google Sheets</strong> distinto al libro
            principal: el ID va en{' '}
            <code className="rounded bg-white/80 px-1 py-0.5 text-[11px] text-gray-800">{envVar}</code>. Suele ser la
            hoja de respuestas de un formulario de <strong>clientes actuales</strong> (Google Forms → vincular a
            Sheets).
          </>
        ) : (
          <>
            Igual que la encuesta de clientes, pero el ID va en{' '}
            <code className="rounded bg-white/80 px-1 py-0.5 text-[11px] text-gray-800">{envVar}</code> para las
            respuestas de <strong>clientes potenciales</strong>.
          </>
        )}{' '}
        La app consulta el rango <code className="rounded bg-white/80 px-1 text-[11px]">{range}</code> de la{' '}
        <strong>primera pestaña</strong> de ese documento (fila 1 cabeceras, siguientes filas = respuestas).
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs text-amber-950/90 leading-relaxed marker:font-semibold">
        <li>
          Abre el documento en{' '}
          <a
            className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
            href="https://sheets.google.com"
            target="_blank"
            rel="noreferrer"
          >
            Google Sheets
          </a>{' '}
          donde llegan las respuestas del formulario. Si hay varias pestañas, coloca la de respuestas como{' '}
          <strong>primera pestaña</strong> o duplica el contenido allí.
        </li>
        <li>
          Copia el <strong>ID del documento</strong> de la URL (
          <span className="whitespace-nowrap text-[11px] text-gray-700">
            …/d/<strong className="text-gray-900">ESTE_ID</strong>/edit
          </span>
          ) y en <code className="rounded bg-white/80 px-1 text-[11px]">.env.local</code> añade o edita:{' '}
          <code className="rounded bg-white/80 px-1 text-[11px]">{envVar}=ESTE_ID</code>
        </li>
        <li>
          En{' '}
          <a
            className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
            href="https://console.cloud.google.com/iam-admin/serviceaccounts"
            target="_blank"
            rel="noreferrer"
          >
            Google Cloud → Service Accounts
          </a>
          , copia el <strong>correo</strong> de la misma cuenta de servicio que usas para el resto de la app (
          <code className="text-[11px]">…iam.gserviceaccount.com</code>).
        </li>
        <li>
          En ese documento de la encuesta: <strong>Compartir</strong> → pega el correo de la service account → rol{' '}
          <strong>Editor</strong> (o al menos Lector). Sin esto aparecerán errores de permiso.
        </li>
        <li>
          En <code className="text-[11px]">.env.local</code> deben estar también{' '}
          <code className="rounded bg-white/80 px-1 text-[11px]">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> y{' '}
          <code className="rounded bg-white/80 px-1 text-[11px]">GOOGLE_PRIVATE_KEY</code> (como en{' '}
          <code className="text-[11px]">.env.example</code>).
        </li>
        <li>
          Guarda, <strong>reinicia</strong> <code className="text-[11px]">npm run dev</code> y recarga esta página.
        </li>
        <li>
          Si la carga funciona pero ves pocos datos: revisa que haya filas con contenido bajo las cabeceras y que los
          filtros de género/edad (arriba) no dejen el conjunto vacío.
        </li>
      </ol>
      <p className="mt-3 text-[11px] text-amber-900/70">
        El libro principal del proyecto usa <code className="text-[11px]">GOOGLE_SHEETS_ID</code>; las dos encuestas
        usan hojas <strong>apartes</strong> con sus propias variables ({' '}
        <code className="text-[11px]">SURVEY_SHEET_ID</code> y <code className="text-[11px]">POTENTIAL_SURVEY_SHEET_ID</code>
        ). Detalle en el README.
      </p>
    </div>
  )
}
