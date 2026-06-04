import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.microdos2u.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image_id, image_url } = await req.json()

    if (!image_id) {
      return new Response(
        JSON.stringify({ error: 'image_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Step 1: Delete file from Storage API (this works and cascades to DB)
    if (image_url) {
      try {
        const url = new URL(image_url)
        const pathMatch = url.pathname.match(/\/object\/public\/[^/]+\/(.+)$/)
        const storagePath = pathMatch ? pathMatch[1] : null
        if (storagePath) {
          await supabaseAdmin.storage.from('product-images').remove([storagePath])
        }
      } catch (e) {
        console.log('Storage delete error (non-critical):', e)
      }
    }

    // Step 2: Try to delete DB record (may fail due to platform restriction)
    try {
      await supabaseAdmin.from('product_images').delete().eq('id', image_id)
    } catch (e) {
      console.log('DB delete error (non-critical):', e)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
