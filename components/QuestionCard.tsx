'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface QuestionCardProps {
  questionId: number
  title: string
  shortTitle: string
  answers: string[]
}

export function QuestionCard({ title, shortTitle, answers }: QuestionCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Badge variant="secondary" className="mb-2 text-xs font-normal">
              {shortTitle}
            </Badge>
            <CardTitle className="text-base font-semibold leading-snug text-gray-800">
              {title}
            </CardTitle>
          </div>
          <Badge className="shrink-0 text-xs">
            {answers.length} {answers.length === 1 ? 'respuesta' : 'respuestas'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
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
    </Card>
  )
}
