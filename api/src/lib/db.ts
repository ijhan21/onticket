import postgres from 'postgres'

let sqlInstance: postgres.Sql | null = null
let configuredUrl: string | null = null

export function setDatabaseUrl(url: string) {
  if (url && url !== configuredUrl) {
    configuredUrl = url
    const isProd = process.env.NODE_ENV === 'production' && !url.includes('localhost')
    sqlInstance = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: isProd ? 'require' : { rejectUnauthorized: false },
    })
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

  if (!sqlInstance) {
    configuredUrl = url
    const isProd = process.env.NODE_ENV === 'production' && !url.includes('localhost')
    sqlInstance = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: isProd ? 'require' : { rejectUnauthorized: false },
    })
  }

  return sqlInstance
}
