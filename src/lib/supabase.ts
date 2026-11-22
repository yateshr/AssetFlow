import { createClient } from '@supabase/supabase-js'

// Where the database address and public key come from, in order:
//  1. /config.js, written when a Docker container starts (one image works for any company)
//  2. .env at build time (development and plain static hosting)
// The public (anon) key is safe in the browser: access is enforced by row-level security.
const runtime = (typeof window !== 'undefined' ? (window as unknown as { __ASSETFLOW_CONFIG__?: { supabaseUrl?: string; supabaseKey?: string } }).__ASSETFLOW_CONFIG__ : undefined) ?? {}
const supabaseUrl = runtime.supabaseUrl || import.meta.env.PUBLIC_SUPABASE_URL
const supabaseKey = runtime.supabaseKey || import.meta.env.PUBLIC_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not configured. Backends features will be unavailable.')
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null
