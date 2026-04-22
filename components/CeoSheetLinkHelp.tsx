/**
 * Guía para vincular Google Sheets con la entrevista CEO cuando falla la carga.
 */
export function CeoSheetLinkHelp() {
  return (
    <div className="mt-6 max-w-xl mx-auto rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-5 text-left shadow-sm sm:px-5">
      <h2 className="text-sm font-semibold text-amber-950">
        Cómo vincular la hoja de cálculo (paso a paso)
      </h2>
      <p className="mt-2 text-xs text-amber-900/85 leading-relaxed">
        Esta pantalla lee el libro configurado en{' '}
        <code className="rounded bg-white/80 px-1 py-0.5 text-[11px] text-gray-800">GOOGLE_SHEETS_ID</code>.
        La API usa el rango <code className="rounded bg-white/80 px-1 text-[11px]">A:N</code> de la{' '}
        <strong>primera pestaña</strong> del documento: fila 1 cabeceras y fila 2 respuestas de la entrevista.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs text-amber-950/90 leading-relaxed marker:font-semibold">
        <li>
          Abre tu documento en{' '}
          <a
            className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
            href="https://sheets.google.com"
            target="_blank"
            rel="noreferrer"
          >
            Google Sheets
          </a>
          . Si la entrevista está en la pestaña <code className="text-[11px]">ceo</code>, colócala como{' '}
          <strong>primera pestaña</strong> (arrastra el nombre de la pestaña a la izquierda) o copia ahí fila 1–2.
        </li>
        <li>
          Copia el <strong>ID del documento</strong> de la URL:{' '}
          <span className="whitespace-nowrap text-[11px] text-gray-700">
            …/spreadsheets/d/<strong className="text-gray-900">ESTE_ID</strong>/edit
          </span>
          . Pégalo en <code className="rounded bg-white/80 px-1 text-[11px]">.env.local</code> como{' '}
          <code className="rounded bg-white/80 px-1 text-[11px]">GOOGLE_SHEETS_ID=…</code>
        </li>
        <li>
          En{' '}
          <a
            className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
            href="https://console.cloud.google.com/iam-admin/serviceaccounts"
            target="_blank"
            rel="noreferrer"
          >
            Google Cloud → IAM → Service Accounts
          </a>
          , abre tu cuenta de servicio y copia su <strong>correo</strong> (termina en{' '}
          <code className="text-[11px]">iam.gserviceaccount.com</code>).
        </li>
        <li>
          En Sheets: <strong>Compartir</strong> → pega ese correo → rol <strong>Editor</strong> (o Lector si solo
          consultas). Sin esto verás errores de permiso.
        </li>
        <li>
          Comprueba en <code className="text-[11px]">.env.local</code> que{' '}
          <code className="rounded bg-white/80 px-1 text-[11px]">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> y{' '}
          <code className="rounded bg-white/80 px-1 text-[11px]">GOOGLE_PRIVATE_KEY</code> coinciden con el JSON de la
          clave (la clave con saltos de línea como <code className="text-[11px]">\n</code> en el .env).
        </li>
        <li>
          Guarda el archivo, <strong>reinicia</strong> el servidor (<code className="text-[11px]">npm run dev</code>) y
          recarga esta página.
        </li>
        <li>
          Si el error dice que no hay respuestas: en la <strong>segunda fila</strong> de esa primera pestaña deben
          existir las respuestas de la entrevista (la fila 1 son títulos).
        </li>
      </ol>
      <p className="mt-3 text-[11px] text-amber-900/70">
        Más detalle en el README del proyecto (variables de entorno y hojas).
      </p>
    </div>
  )
}
