export interface IntegrationEndpoint {
  baseUrl: string
  apiKey: string
}

/** Each side is defined only when both of its env vars are set. Keys stay server-side and are never logged. */
export function integrationConfig(env: NodeJS.ProcessEnv = process.env): { hms?: IntegrationEndpoint; pos?: IntegrationEndpoint } {
  const pair = (url?: string, key?: string) => (url && key ? { baseUrl: url, apiKey: key } : undefined)
  return {
    hms: pair(env.HMS_BASE_URL, env.HMS_API_KEY),
    pos: pair(env.POS_BASE_URL, env.POS_API_KEY),
  }
}
