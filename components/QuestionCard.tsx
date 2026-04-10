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
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left">
        <CardHeader className="pb-3 hover:bg-gray-50 transition-colors cursor-pointer">
          {/* Top row: badge + arrow */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <Badge variant="secondary" className="text-xs font-normal truncate max-w-[75%]">
              {shortTitle}
            </Badge>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className="text-xs whitespace-nowrap">
                {answers.length} {answers.length === 1 ? 'resp.' : 'resp.'}
              </Badge>
              <span
                className="text-gray-400 transition-transform duration-200 shrink-0"
                style={{
                  display: 'inline-block',
                  fontSize: '28px',
                  lineHeight: 1,
                  transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▾
              </span>
            </div>
          </div>
          {/* Title on its own row — wraps freely */}
          <CardTitle className="text-sm sm:text-base font-semibold leading-snug text-gray-800 text-left">
            {title}
          </CardTitle>
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
                  className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-700 leading-relaxed border-l-2 border-gray-200"
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
