import type { APIRoute } from 'astro'

const robotsTxt = `\
User-agent: *
Disallow: /dist/
`

export const GET: APIRoute = () => {
  return new Response(robotsTxt)
}
