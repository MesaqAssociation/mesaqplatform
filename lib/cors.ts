// CORS headers for mobile app support
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Helper to create OPTIONS handler
export function createOptionsHandler() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

