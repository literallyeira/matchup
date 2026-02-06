import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Application {
  id: string
  first_name: string
  last_name: string
  age: number
  gender: string
  sexual_preference: string
  phone: string
  facebrowser: string
  description: string
  photo_url: string
  created_at: string
  // New fields for GTAW integration
  gtaw_user_id?: number
  character_id?: number
  character_name?: string
}

export interface User {
  id: string
  gtaw_id: number
  username: string
  created_at: string
}

export interface Match {
  id: string
  application_1_id: string
  application_2_id: string
  created_at: string
  created_by?: string
  // Joined data
  application_1?: Application
  application_2?: Application
}
