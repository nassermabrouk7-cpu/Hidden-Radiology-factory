import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // اسمح للـ API والمصنع يعدو بدون بلوك
  if (path.startsWith('/api/') || path.startsWith('/maestro')) {
    return NextResponse.next()
  }

  // باقي الموقع - اسمح عادي (او اعمل check)
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
