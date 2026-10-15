/**
 * src/lib/alerts/ssrf.ts
 * Enterprise-grade Server-Side Request Forgery (SSRF) defense, safe outbound HTTP dispatcher,
 * and timing-safe webhook HMAC verification for NEXSTORM P21.
 */

import crypto from 'node:crypto'
import dns from 'node:dns'
import net from 'node:net'

export interface SsrValidationResult {
  isValid: boolean
  error?: string
  parsedUrl?: URL
  resolvedIps?: string[]
}

export interface SafeFetchOptions {
  maxRedirects?: number
  maxResponseBytes?: number
  timeoutMs?: number
  allowHttpInDev?: boolean
  dnsResolver?: (host: string) => Promise<string[]>
}

const ALLOWED_PORTS = new Set([80, 443, 8443])

const PROHIBITED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'instance-data',
  'metadata.internal',
])

/**
 * Normalizes alternate numeric IP representations (decimal, octal, hex, compact)
 * into a standard dot-decimal IPv4 string if applicable.
 */
export function normalizeNumericIpv4(host: string): string | null {
  const trimmed = host.trim()
  if (!trimmed) return null

  // Check if it's a single 32-bit integer (e.g. 2130706433 or 0x7f000001)
  if (/^(?:0x[0-9a-fA-F]+|\d+)$/.test(trimmed)) {
    try {
      const num = trimmed.startsWith('0x') || trimmed.startsWith('0X')
        ? parseInt(trimmed, 16)
        : parseInt(trimmed, 10)
      if (num >= 0 && num <= 0xffffffff) {
        return [
          (num >>> 24) & 0xff,
          (num >>> 16) & 0xff,
          (num >>> 8) & 0xff,
          num & 0xff,
        ].join('.')
      }
    } catch {
      return null
    }
  }

  // Check multi-part dot notation with potential octal/hex parts (e.g. 0177.0.0.1 or 0x7f.0.0.1)
  const parts = trimmed.split('.')
  if (parts.length >= 2 && parts.length <= 4) {
    const parsedParts: number[] = []
    for (const part of parts) {
      if (!part) return null
      let val: number
      if (part.startsWith('0x') || part.startsWith('0X')) {
        val = parseInt(part, 16)
      } else if (part.startsWith('0') && part.length > 1 && /^[0-7]+$/.test(part)) {
        val = parseInt(part, 8)
      } else if (/^\d+$/.test(part)) {
        val = parseInt(part, 10)
      } else {
        return null
      }
      if (isNaN(val) || val < 0) return null
      parsedParts.push(val)
    }

    if (parsedParts.length === 4) {
      if (parsedParts.every((p) => p <= 255)) {
        return parsedParts.join('.')
      }
    } else if (parsedParts.length === 2) {
      // e.g. 127.1 -> 127.0.0.1
      const [first, last] = parsedParts
      if (first <= 255 && last <= 0xffffff) {
        return [
          first,
          (last >>> 16) & 0xff,
          (last >>> 8) & 0xff,
          last & 0xff,
        ].join('.')
      }
    }
  }

  return null
}

/**
 * Checks whether an IPv4 address string falls into private, loopback, link-local,
 * or reserved address space.
 */
export function isProhibitedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true
  }

  const [o1, o2, o3] = parts

  // 0.0.0.0/8 (Current network)
  if (o1 === 0) return true
  // 10.0.0.0/8 (Private network RFC 1918)
  if (o1 === 10) return true
  // 100.64.0.0/10 (Shared address space RFC 6598)
  if (o1 === 100 && o2 >= 64 && o2 <= 127) return true
  // 127.0.0.0/8 (Loopback RFC 1122)
  if (o1 === 127) return true
  // 169.254.0.0/16 (Link-local RFC 3927 & Cloud metadata 169.254.169.254)
  if (o1 === 169 && o2 === 254) return true
  // 172.16.0.0/12 (Private network RFC 1918: 172.16.0.0 - 172.31.255.255)
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return true
  // 192.0.0.0/24 (IETF protocol assignments)
  if (o1 === 192 && o2 === 0 && o3 === 0) return true
  // 192.0.2.0/24 (TEST-NET-1)
  if (o1 === 192 && o2 === 0 && o3 === 2) return true
  // 192.88.99.0/24 (6to4 relay)
  if (o1 === 192 && o2 === 88 && o3 === 99) return true
  // 192.168.0.0/16 (Private network RFC 1918)
  if (o1 === 192 && o2 === 168) return true
  // 198.18.0.0/15 (Network benchmark RFC 2544)
  if (o1 === 198 && (o2 === 18 || o2 === 19)) return true
  // 198.51.100.0/24 (TEST-NET-2)
  if (o1 === 198 && o2 === 51 && o3 === 100) return true
  // 203.0.113.0/24 (TEST-NET-3)
  if (o1 === 203 && o2 === 0 && o3 === 113) return true
  // 224.0.0.0/4 (Multicast RFC 5771)
  if (o1 >= 224 && o1 <= 239) return true
  // 240.0.0.0/4 (Reserved RFC 1112)
  if (o1 >= 240) return true

  return false
}

/**
 * Checks whether an IPv6 address string falls into private, loopback, link-local,
 * or mapped IPv4 private space.
 */
export function isProhibitedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim().replace(/^\[|\]$/g, '')

  // Unspecified / loopback
  if (normalized === '::' || normalized === '::1') return true

  // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
  const mappedMatch = normalized.match(/^(?:::ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (mappedMatch) {
    return isProhibitedIpv4(mappedMatch[1])
  }

  // IPv4-mapped in hex (::ffff:7f00:0001 or ::ffff:c0a8:0101)
  const hexMappedMatch = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hexMappedMatch) {
    const hi = parseInt(hexMappedMatch[1], 16)
    const lo = parseInt(hexMappedMatch[2], 16)
    const o1 = (hi >> 8) & 0xff
    const o2 = hi & 0xff
    const o3 = (lo >> 8) & 0xff
    const o4 = lo & 0xff
    return isProhibitedIpv4(`${o1}.${o2}.${o3}.${o4}`)
  }

  // Unique Local (fc00::/7 -> fc00:: through fdff::)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true

  // Link-local (fe80::/10 -> fe80:: through febf::)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) return true

  // Documentation (2001:db8::/32)
  if (normalized.startsWith('2001:db8') || normalized.startsWith('2001:0db8')) return true

  // IPv4/IPv6 translation prefix (64:ff9b::/96 RFC 6052)
  if (normalized.startsWith('64:ff9b:')) return true

  // Discard prefix (100::/64 RFC 6666)
  if (normalized.startsWith('100::') || normalized.startsWith('0100:')) return true

  // Benchmarking (2001:2::/48 RFC 5180)
  if (normalized.startsWith('2001:2:') || normalized.startsWith('2001:0002:')) return true

  // ORCHIDv2 (2001:10::/28 RFC 7343)
  if (normalized.startsWith('2001:1') || normalized.startsWith('2001:001')) return true

  // 6to4 prefix (2002::/16 RFC 3056)
  if (normalized.startsWith('2002:')) return true

  return false
}

/**
 * Validates any IP address (IPv4 or IPv6, in any valid representation).
 */
export function isProhibitedIp(ip: string): boolean {
  const clean = ip.trim().replace(/^\[|\]$/g, '')

  // Try direct IPv4 normalization first
  const normalizedIpv4 = normalizeNumericIpv4(clean)
  if (normalizedIpv4) {
    return isProhibitedIpv4(normalizedIpv4)
  }

  if (net.isIPv4(clean)) {
    return isProhibitedIpv4(clean)
  }

  if (net.isIPv6(clean) || clean.includes(':')) {
    return isProhibitedIpv6(clean)
  }

  return false
}

/**
 * Validates a target URL against all SSRF vectors:
 * - Scheme (only https: in production; http: allowed in non-prod for mocks)
 * - Prohibited hostnames (.local, .internal, localhost, etc.)
 * - Alternate numeric IP encodings
 * - Standard web ports only (80, 443, 8443)
 * - DNS resolution to prohibited addresses
 */
export async function validateOutboundUrl(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SsrValidationResult> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return { isValid: false, error: `Invalid URL format '${rawUrl}'` }
  }

  // 1. Protocol Restriction
  const isProduction = process.env.NODE_ENV === 'production'
  const allowHttp = options.allowHttpInDev && !isProduction
  if (parsedUrl.protocol !== 'https:' && (!allowHttp || parsedUrl.protocol !== 'http:')) {
    return {
      isValid: false,
      error: isProduction
        ? `Insecure protocol '${parsedUrl.protocol}': Production webhooks strictly require 'https:'`
        : `Disallowed protocol '${parsedUrl.protocol}': Only 'https:' (or 'http:' in dev) permitted`,
      parsedUrl,
    }
  }

  // 2. Reject User Credentials in URL
  if (parsedUrl.username || parsedUrl.password) {
    return {
      isValid: false,
      error: 'URLs containing embedded credentials (user:pass@) are prohibited for security',
      parsedUrl,
    }
  }

  // 3. Port Restriction
  const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : parsedUrl.protocol === 'https:' ? 443 : 80
  if (!ALLOWED_PORTS.has(port)) {
    return {
      isValid: false,
      error: `Port ${port} is prohibited. Outbound dispatches are restricted to standard web ports (80, 443, 8443)`,
      parsedUrl,
    }
  }

  const hostname = parsedUrl.hostname.toLowerCase().trim().replace(/^\[|\]$/g, '')

  // 4. Prohibited Hostname Checks
  if (
    PROHIBITED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return {
      isValid: false,
      error: `SSRF Blocked: Destination hostname '${hostname}' is an internal/private domain`,
      parsedUrl,
    }
  }

  // 5. Alternate Numeric IP / Literal IP Check
  if (isProhibitedIp(hostname)) {
    return {
      isValid: false,
      error: `SSRF Blocked: Destination '${hostname}' resolves to a private, loopback, or reserved IP address`,
      parsedUrl,
    }
  }

  // 6. DNS Resolution Check (Resolve all records and test every IP)
  const resolvedIps: string[] = []
  if (!net.isIP(hostname)) {
    try {
      if (options.dnsResolver) {
        const customResolved = await options.dnsResolver(hostname)
        resolvedIps.push(...customResolved)
      } else {
        const lookups = await dns.promises.lookup(hostname, { all: true })
        for (const entry of lookups) {
          resolvedIps.push(entry.address)
        }
      }
    } catch (dnsErr) {
      return {
        isValid: false,
        error: `DNS resolution failure for '${hostname}': ${dnsErr instanceof Error ? dnsErr.message : String(dnsErr)}`,
        parsedUrl,
      }
    }

    if (resolvedIps.length === 0) {
      return {
        isValid: false,
        error: `DNS lookup returned no IP addresses for host '${hostname}'`,
        parsedUrl,
      }
    }

    for (const ip of resolvedIps) {
      if (isProhibitedIp(ip)) {
        return {
          isValid: false,
          error: `SSRF Blocked: Host '${hostname}' resolves to prohibited IP '${ip}'`,
          parsedUrl,
          resolvedIps,
        }
      }
    }
  } else {
    resolvedIps.push(hostname)
  }

  return {
    isValid: true,
    parsedUrl,
    resolvedIps,
  }
}

/**
 * Executes a hardened outbound HTTP fetch with:
 * - Pre-flight SSRF validation
 * - Manual redirect inspection (re-validating every redirect hop against SSRF rules)
 * - Maximum response payload bounding (16KB cap)
 * - Hard request timeout (default 5000ms)
 */
export async function safeOutboundFetch(
  targetUrl: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {}
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 2
  const timeoutMs = options.timeoutMs ?? 5000

  let currentUrl = targetUrl
  let redirectsCount = 0

  while (true) {
    // Validate current hop URL
    const validation = await validateOutboundUrl(currentUrl, options)
    if (!validation.isValid) {
      throw new Error(`SSRF Blocked: ${validation.error}`)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(currentUrl, {
        ...init,
        redirect: 'manual', // Never follow redirects blindly
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    // Check for Redirect (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      redirectsCount++
      if (redirectsCount > maxRedirects) {
        throw new Error(`Exceeded maximum allowed redirects (${maxRedirects}) for outbound webhook`)
      }

      const locationHeader = response.headers.get('location')
      if (!locationHeader) {
        throw new Error(`HTTP ${response.status} redirect received without Location header`)
      }

      // Resolve relative redirect against current URL
      currentUrl = new URL(locationHeader, currentUrl).toString()
      continue
    }

    // Enforce Content-Length header limit if present
    const maxBytes = options.maxResponseBytes ?? 16384
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      throw new Error(`SSRF Blocked: Response Content-Length (${contentLength} bytes) exceeds maximum allowed ${maxBytes} bytes`)
    }

    return response
  }
}

/**
 * Safely reads a response body stream bounded to a maximum number of bytes,
 * preventing memory bomb / infinite chunked streaming attacks.
 */
export async function readBoundedResponseBody(
  response: Response,
  maxBytes: number = 16384
): Promise<string> {
  if (!response.body) {
    return ''
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        totalBytes += value.length
        if (totalBytes > maxBytes) {
          throw new Error(`Response body exceeded maximum allowed limit of ${maxBytes} bytes`)
        }
        chunks.push(value)
      }
    }
  } finally {
    reader.releaseLock()
  }

  const combined = new Uint8Array(totalBytes)
  let offset = 0
  for (const c of chunks) {
    combined.set(c, offset)
    offset += c.length
  }
  return new TextDecoder().decode(combined)
}

/**
 * Timing-safe HMAC-SHA256 signature verifier for incoming or outgoing webhooks.
 * Features replay defense with configurable tolerance window (default 300s).
 */
export function verifyWebhookSignature(options: {
  payload: string
  signatureHeader: string
  secret: string
  toleranceSeconds?: number
}): { valid: boolean; reason?: string } {
  const { payload, signatureHeader, secret } = options
  const tolerance = options.toleranceSeconds ?? 300

  if (!signatureHeader) {
    return { valid: false, reason: 'Missing X-Nexstorm-Signature header' }
  }

  // Parse t=<timestamp>,v1=<signature>
  const parts = signatureHeader.split(',')
  const tPart = parts.find((p) => p.startsWith('t='))
  const v1Part = parts.find((p) => p.startsWith('v1='))

  if (!tPart || !v1Part) {
    return { valid: false, reason: 'Malformed signature header format: expected "t=...,v1=..."' }
  }

  const timestamp = parseInt(tPart.slice(2), 10)
  const signatureHex = v1Part.slice(3).trim()

  if (isNaN(timestamp)) {
    return { valid: false, reason: 'Invalid signature timestamp' }
  }

  // Replay Attack Defense
  const now = Math.floor(Date.now() / 1000)
  if (timestamp < now - tolerance) {
    return { valid: false, reason: `Signature expired: timestamp older than ${tolerance} seconds` }
  }
  if (timestamp > now + 60) {
    return { valid: false, reason: 'Signature invalid: timestamp is in the future' }
  }

  // Compute expected HMAC
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')

  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8')
  const actualBuffer = Buffer.from(signatureHex, 'utf-8')

  if (expectedBuffer.length !== actualBuffer.length) {
    return { valid: false, reason: 'Signature length mismatch' }
  }

  // Timing-safe constant-time comparison
  const isValid = crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  if (!isValid) {
    return { valid: false, reason: 'Signature mismatch' }
  }

  return { valid: true }
}
