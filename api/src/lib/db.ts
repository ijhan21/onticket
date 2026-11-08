import postgres from 'postgres'

let sqlInstance: postgres.Sql | null = null
let configuredUrl: string | null = null

export function setDatabaseUrl(url: string) {
  if (url && url !== configuredUrl) {
    configuredUrl = url
    sqlInstance = null
  }
}

export function getDb(connectionString?: string): postgres.Sql {
  const url =
    connectionString ||
    configuredUrl ||
    (typeof process !== 'undefined' ? process.env?.DATABASE_URL : undefined)

  if (!url) {
    throw new Error('DATABASE_URL is not configured')
  }

  const isHyperdrive = url.includes('hyperdrive') || url.includes('cloudflare') || url.includes('127.0.0.1')

  if (isHyperdrive) {
    return postgres(url, {
      max: 5,
      idle_timeout: 0,
      connect_timeout: 10,
      ssl: false,
    })
  }

  if (!sqlInstance || configuredUrl !== url) {
    configuredUrl = url
    sqlInstance = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: { rejectUnauthorized: false },
    })
  }

  return sqlInstance
}
