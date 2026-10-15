import { NextResponse } from 'next/server'
import { routingPlanSchema } from '@/lib/validations/roads'
import { roadRoutingEngine } from '@/lib/roads/router'

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

    if (cityId !== 'amritsar') {
      return NextResponse.json(
        {
          error: `Road routing is currently only available for Amritsar (requested '${cityId}')`,
        },
        { status: 404 }
      )
    }

    const result = await roadRoutingEngine.planRoutes({
      cityId,
      origin,
      destination,
      originName,
      destinationName,
    })

    return NextResponse.json({
      cityId,
      timestamp: new Date().toISOString(),
      provenance: {
        source: 'NEXSTORM Road Risk & Flood-Aware Router P13',
        network: '28,418 noded vertices and 37,924 edges in Amritsar',
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

    if (cityId !== 'amritsar') {
      return NextResponse.json(
        {
          error: `Road routing is currently only available for Amritsar (requested '${cityId}')`,
        },
        { status: 404 }
      )
    }

    const result = await roadRoutingEngine.planRoutes(parseResult.data)

    return NextResponse.json({
      cityId,
      timestamp: new Date().toISOString(),
      provenance: {
        source: 'NEXSTORM Road Risk & Flood-Aware Router P13',
        network: '28,418 noded vertices and 37,924 edges in Amritsar',
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
