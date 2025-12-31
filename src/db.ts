import { createClient } from '@supabase/supabase-js'

export interface Env {
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    ASSETS: Fetcher
}

export function useDB(env: Env) {
    return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
}
