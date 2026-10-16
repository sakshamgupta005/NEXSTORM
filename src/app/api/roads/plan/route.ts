import { NextResponse } from 'next/server'
import { routingPlanSchema } from '@/lib/validations/roads'
import { roadRoutingEngine } from '@/lib/roads/router'
import { isCitySupported } from '@/lib/city/registry'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parseResult = routingPlanSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid route planning parameters',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { cityId, origin, destination, originName, destinationName } = parseResult.data
    const normalizedCity = (cityId || 'amritsar').toLowerCase()

    if (!isCitySupported(normalizedCity)) {
      return NextResponse.json(
        {
          error: `Road routing is only available for Amritsar and Jalandhar (requested '${cityId}')`,
        },
        { status: 404 }
      )
    }

    const result = await roadRoutingEngine.planRoutes({
      cityId: normalizedCity,
      origin,
      destination,
      originName,
      destinationName,
    })

    const networkDesc = normalizedCity === 'jalandhar'
      ? '81,688 routing nodes and 93,031 edges in Jalandhar'
      : '28,418 noded vertices and 37,924 edges in Amritsar'

    return NextResponse.json({
      cityId: normalizedCity,
      timestamp: new Date().toISOString(),
      provenance: {
        source: 'NEXSTORM Road Risk & Flood-Aware Router P13',
        network: networkDesc,
        disclaimer:
          'Experimental route comparison based on 250m susceptibility grid intersections, underpass chokepoints, and verified community observations. Not an operational navigation system with real-time flood gauges or live traffic.',
      },
      data: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown routing error'
    // If it's an unreachable destination or out of bounds coordinate
    if (
      message.includes('bounds') ||
      message.includes('unreachable') ||
      message.includes('same road network node')
    ) {
      return NextResponse.json({ error: message }, { status: 422 })
    }

    console.error('Route plan error:', err)
    return NextResponse.json(
      { error: 'Internal server error calculating route' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const originLng = parseFloat(searchParams.get('originLng') || '')
    const originLat = parseFloat(searchParams.get('originLat') || '')
    const destLng = parseFloat(searchParams.get('destLng') || '')
    const destLat = parseFloat(searchParams.get('destLat') || '')
    const cityId = searchParams.get('cityId') || 'amritsar'
    const originName = searchParams.get('originName') || undefined
    const destinationName = searchParams.get('destName') || undefined

    const parseResult = routingPlanSchema.safeParse({
      cityId,
      origin: [originLng, originLat],
      destination: [destLng, destLat],
      originName,
      destinationName,
    })

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid route planning query parameters',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      )
    }

    const normalizedCity = (cityId || 'amritsar').toLowerCase()
    if (!isCitySupported(normalizedCity)) {
      return NextResponse.json(
        {
          error: `Road routing is not supported for city '${cityId}'`,
        },
        { status: 404 }
      )
    }

    const result = await roadRoutingEngine.planRoutes({
      ...parseResult.data,
      cityId: normalizedCity,
    })

    const networkDesc = normalizedCity === 'jalandhar'
      ? '81,688 routing nodes and 93,031 edges in Jalandhar'
      : '28,418 noded vertices and 37,924 edges in Amritsar'

    return NextResponse.json({
      cityId: normalizedCity,
      timestamp: new Date().toISOString(),
      provenance: {
        source: 'NEXSTORM Road Risk & Flood-Aware Router P13',
        network: networkDesc,
        disclaimer:
          'Experimental route comparison based on 250m susceptibility grid intersections, underpass chokepoints, and verified community observations. Not an operational navigation system with real-time flood gauges or live traffic.',
      },
      data: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown routing error'
    if (
      message.includes('bounds') ||
      message.includes('unreachable') ||
      message.includes('same road network node')
    ) {
      return NextResponse.json({ error: message }, { status: 422 })
    }

    console.error('Route plan GET error:', err)
    return NextResponse.json(
      { error: 'Internal server error calculating route' },
      { status: 500 }
    )
  }
}
