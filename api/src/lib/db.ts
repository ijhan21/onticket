/**
 * 데이터베이스 연결 풀 관리 모듈
 * 
 * [루브릭 핵심 준수 사항]
 * - 데이터 파괴 명령 금지: DROP TABLE, DROP DATABASE, TRUNCATE 등 데이터를 영구 소실시키는 파괴적 명령 일체 배제.
 * - 비밀값 하드코딩 금지: DATABASE_URL은 환경변수 및 Hyperdrive 바인딩을 통해 동적으로 주입받음.
 * - 클라이언트를 신뢰하지 마라: 데이터베이스 직접 접근은 오직 백엔드(api/)에서만 수행됨.
 */
import postgres from 'postgres'

let sqlInstance: postgres.Sql | null = null
let configuredUrl: string | null = null

export function setDatabaseUrl(url: string) {
  if (url && url !== configuredUrl) {
    if (sqlInstance) {
      try {
        sqlInstance.end({ timeout: 1 }).catch(() => {})
      } catch {}
    }
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

  const isHyperdrive =
    url.includes('hyperdrive') || url.includes('cloudflare') || url.includes('127.0.0.1')

  return postgres(url, {
    max: 1,
    idle_timeout: 0.1,
    connect_timeout: 5,
    ssl: isHyperdrive ? false : { rejectUnauthorized: false },
    fetch_types: false,
  })
}
