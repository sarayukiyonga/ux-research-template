'use client'

import { useRouter } from 'next/navigation'

export function DashboardLogoutBar({ footerBrand }: { footerBrand: string }) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex items-center justify-center gap-4 pb-8">
      <p className="text-xs text-gray-300">{footerBrand}</p>
      <button
        type="button"
        onClick={handleLogout}
        className="text-xs text-gray-300 underline underline-offset-2 transition-colors hover:text-gray-500"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
