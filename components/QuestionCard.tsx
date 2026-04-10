'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface QuestionCardProps {
  questionId: number
  title: string
  shortTitle: string
  answers: string[]
}

export function QuestionCard({ title, shortTitle, answers }: QuestionCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <Card className="w-full overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left"
      >
        <CardHeader className="pb-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Badge variant="secondary" className="mb-2 text-xs font-normal">
                {shortTitle}
              </Badge>
              <CardTitle className="text-base font-semibold leading-snug text-gray-800">
                {title}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              <Badge className="text-xs">
                {answers.length} {answers.length === 1 ? 'respuesta' : 'respuestas'}
              </Badge>
              <span className="text-gray-400 text-sm transition-transform duration-200" style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▾
              </span>
            </div>
          </div>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="pt-0 border-t border-gray-100">
          <div className="space-y-2 pt-3">
            {answers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin respuestas</p>
            ) : (
              answers.map((answer, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 leading-relaxed border-l-2 border-gray-200"
                >
                  <span className="text-xs font-medium text-gray-400 mr-2">#{i + 1}</span>
                  {answer}
                </div>
              ))
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
