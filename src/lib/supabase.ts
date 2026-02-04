import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Application {
  id: string
  first_name: string
  last_name: string
  age: number
  weight: number
  gender: string
  sexual_preference: string
  phone: string
  facebrowser: string
  description: string
  photo_url: string
  created_at: string
}
