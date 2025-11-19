'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function BackButton() {
  const router = useRouter()
  return (
    <Button variant="outline" size="sm" onClick={() => router.back()}>
      <ArrowLeft className="mr-1 h-4 w-4" />
      Back
    </Button>
  )
}
