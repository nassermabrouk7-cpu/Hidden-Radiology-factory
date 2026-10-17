import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(){
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await supabase.from('campaigns').select('*').order('created_at', {ascending: false}).limit(50)
  return NextResponse.json(data || [])
}