import { NextResponse } from 'next/server';
import { routeCompareRequestSchema } from '@/lib/validations/roads';
import { roadRiskService } from '@/lib/roads/service';
import { isCitySupported } from '@/lib/city/registry';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = routeCompareRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid route comparison request',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { cityId, routes } = parseResult.data;
    const normalizedCity = (cityId || 'amritsar').toLowerCase();

    if (!isCitySupported(normalizedCity)) {
      return NextResponse.json(
        {
          error: `Road network data is not supported for city '${cityId}'`,
        },
        { status: 404 }
      );
    }

    const comparison = await roadRiskService.evaluateCandidateRoutes(routes, normalizedCity);

    return NextResponse.json({
      cityId: normalizedCity,
      timestamp: new Date().toISOString(),
      provenance: {
        source: 'NEXSTORM Road Risk Engine P11',
        disclaimer:
          'Experimental route flood risk comparison based on 250m susceptibility grid intersections, tagged underpasses, and verified community observations. Not an operational routing engine.',
      },
      data: comparison,
    });
  } catch (err) {
    console.error('Route compare error:', err);
    return NextResponse.json(
      { error: 'Internal server error evaluating routes' },
      { status: 500 }
    );
  }
}
