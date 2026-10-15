/**
 * src/lib/roads/router.ts
 * High-performance A* / Dijkstra origin-to-destination routing engine for Amritsar.
 * Reuses the noded topological road network (28,418 nodes, 37,924 edges)
 * and evaluates candidate paths using NEXSTORM's multi-cell road-risk evidence.
 */

import fs from 'node:fs'
import path from 'node:path'
import { roadRiskService } from './service'
import type {
  CandidateRouteInput,
  RoutingPlanRequest,
  RoutingPlanResult,
} from './types'

interface RoutingEdge {
  from: number
  to: number
  lengthM: number
  segmentId: string
  maxS: number
  isUnderpass: boolean
  highway: string
}

interface RawRoutingGraph {
  cityId: string
  totalNodes: number
  totalEdges: number
  nodes: [number, number][] // [ [lng, lat], ... ]
  edges: RoutingEdge[]
}

interface AdjacencyEdge {
  to: number
  edge: RoutingEdge
}

class MinHeap {
  private heap: { val: number; priority: number }[] = []

  public push(val: number, priority: number): void {
    this.heap.push({ val, priority })
    this.bubbleUp(this.heap.length - 1)
  }

  public pop(): { val: number; priority: number } | null {
    if (this.heap.length === 0) return null
    const top = this.heap[0]
    const bottom = this.heap.pop()
    if (this.heap.length > 0 && bottom !== undefined) {
      this.heap[0] = bottom
      this.sinkDown(0)
    }
    return top
  }

  public isEmpty(): boolean {
    return this.heap.length === 0
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1
      if (this.heap[idx].priority < this.heap[parentIdx].priority) {
        const tmp = this.heap[idx]
        this.heap[idx] = this.heap[parentIdx]
        this.heap[parentIdx] = tmp
        idx = parentIdx
      } else {
        break
      }
    }
  }

  private sinkDown(idx: number): void {
    const len = this.heap.length
    while (true) {
      const left = (idx << 1) + 1
      const right = left + 1
      let smallest = idx

      if (left < len && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left
      }
      if (right < len && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right
      }
      if (smallest !== idx) {
        const tmp = this.heap[idx]
        this.heap[idx] = this.heap[smallest]
        this.heap[smallest] = tmp
        idx = smallest
      } else {
        break
      }
    }
  }
}

export class RoadRoutingEngine {
  private static instance: RoadRoutingEngine
  private graph: RawRoutingGraph | null = null
  private adjacency: Map<number, AdjacencyEdge[]> | null = null

  private constructor() {}

  public static getInstance(): RoadRoutingEngine {
    if (!RoadRoutingEngine.instance) {
      RoadRoutingEngine.instance = new RoadRoutingEngine()
    }
    return RoadRoutingEngine.instance
  }

  /**
   * Loads the noded topological routing graph into memory once.
   */
  public loadGraph(cityId: string = 'amritsar'): RawRoutingGraph {
    if (this.graph && this.adjacency) {
      return this.graph
    }

    const graphPath = path.join(
      process.cwd(),
      'public',
      'data',
      'cities',
      cityId.toLowerCase(),
      'roads',
      'routing_graph.json'
    )

    if (!fs.existsSync(graphPath)) {
      throw new Error(`Routing graph file not found at ${graphPath}`)
    }

    const raw = fs.readFileSync(graphPath, 'utf-8')
    this.graph = JSON.parse(raw) as RawRoutingGraph

    // Build bidirected adjacency list
    this.adjacency = new Map<number, AdjacencyEdge[]>()
    for (const e of this.graph.edges) {
      if (!this.adjacency.has(e.from)) this.adjacency.set(e.from, [])
      if (!this.adjacency.has(e.to)) this.adjacency.set(e.to, [])
      this.adjacency.get(e.from)!.push({ to: e.to, edge: e })
      this.adjacency.get(e.to)!.push({ to: e.from, edge: e })
    }

    return this.graph
  }

  /**
   * Snaps a geographic coordinate [lng, lat] to the nearest road network node.
   */
  public snapToNode(
    coord: [number, number],
    maxDistanceMeters: number = 3000
  ): {
    nodeId: number
    snappedCoord: [number, number]
    distanceMeters: number
  } {
    const graph = this.loadGraph('amritsar')
    const [targetLng, targetLat] = coord

    let bestNode = -1
    let bestDistSq = Infinity

    for (let i = 0; i < graph.nodes.length; i++) {
      const pt = graph.nodes[i]
      const dx = (pt[0] - targetLng) * 95000
      const dy = (pt[1] - targetLat) * 111000
      const distSq = dx * dx + dy * dy
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        bestNode = i
      }
    }

    const distM = Math.sqrt(bestDistSq)
    if (distM > maxDistanceMeters) {
      throw new Error(
        `Coordinates [${targetLng.toFixed(4)}, ${targetLat.toFixed(4)}] exceed road network bounds (${Math.round(distM)}m to nearest road, max permitted ${maxDistanceMeters}m).`
      )
    }

    return {
      nodeId: bestNode,
      snappedCoord: graph.nodes[bestNode],
      distanceMeters: Math.round(distM * 10) / 10,
    }
  }

  /**
   * A* shortest path search over the topological road graph.
   */
  private findPath(
    startNode: number,
    endNode: number,
    weightFn: (edge: RoutingEdge) => number
  ): {
    realDistanceM: number
    pathEdges: RoutingEdge[]
    pathCoords: [number, number][]
  } | null {
    const graph = this.loadGraph('amritsar')
    const adj = this.adjacency!
    const n = graph.nodes.length

    if (startNode === endNode) {
      return {
        realDistanceM: 0,
        pathEdges: [],
        pathCoords: [graph.nodes[startNode]],
      }
    }

    const dist = new Float64Array(n).fill(Infinity)
    const prevNode = new Int32Array(n).fill(-1)
    const prevEdge = new Array<RoutingEdge>(n)
    const visited = new Uint8Array(n)

    const pq = new MinHeap()
    dist[startNode] = 0
    pq.push(startNode, 0)

    const destCoords = graph.nodes[endNode]

    while (!pq.isEmpty()) {
      const top = pq.pop()
      if (!top) break
      const u = top.val
      if (visited[u]) continue
      visited[u] = 1

      if (u === endNode) break

      const neighbors = adj.get(u) || []
      for (let i = 0; i < neighbors.length; i++) {
        const { to: v, edge } = neighbors[i]
        if (visited[v]) continue

        const cost = weightFn(edge)
        const newDist = dist[u] + cost

        if (newDist < dist[v]) {
          dist[v] = newDist
          prevNode[v] = u
          prevEdge[v] = edge

          // A* Euclidean heuristic in meters
          const vPt = graph.nodes[v]
          const h = Math.hypot(
            (vPt[0] - destCoords[0]) * 95000,
            (vPt[1] - destCoords[1]) * 111000
          )
          pq.push(v, newDist + h)
        }
      }
    }

    if (dist[endNode] === Infinity) {
      return null
    }

    const pathEdges: RoutingEdge[] = []
    const pathCoords: [number, number][] = []
    let curr = endNode
    pathCoords.push(graph.nodes[curr])

    let realDistanceM = 0
    while (curr !== startNode) {
      const edge = prevEdge[curr]
      pathEdges.push(edge)
      realDistanceM += edge.lengthM
      curr = prevNode[curr]
      pathCoords.push(graph.nodes[curr])
    }

    pathCoords.reverse()
    pathEdges.reverse()

    return {
      realDistanceM: Math.round(realDistanceM * 10) / 10,
      pathEdges,
      pathCoords,
    }
  }

  /**
   * Plans origin-to-destination routes, generating 3 distinct options:
   * 1. Shortest distance route
   * 2. Lower modeled exposure route (penalizes high susceptibility & underpasses)
   * 3. Balanced route (moderate penalty for detour minimization)
   */
  public async planRoutes(request: RoutingPlanRequest): Promise<RoutingPlanResult> {
    const cityId = request.cityId || 'amritsar'
    if (cityId !== 'amritsar') {
      throw new Error(`Routing is currently only available for Amritsar (requested '${cityId}')`)
    }

    const originSnap = this.snapToNode(request.origin)
    const destSnap = this.snapToNode(request.destination)

    if (originSnap.nodeId === destSnap.nodeId) {
      throw new Error('Origin and destination snap to the same road network node. Please choose points farther apart.')
    }

    // 1. Shortest Route (Pure metric distance)
    const shortestPath = this.findPath(
      originSnap.nodeId,
      destSnap.nodeId,
      (e) => e.lengthM
    )

    if (!shortestPath) {
      throw new Error('Destination is unreachable via the connected road network from the selected origin.')
    }

    // 2. Lower Modeled Exposure Route
    // Heavily penalizes high-susceptibility zones (s >= 0.66) and structural underpasses
    const safestPath = this.findPath(
      originSnap.nodeId,
      destSnap.nodeId,
      (e) => {
        const underpassPenalty = e.isUnderpass ? 5000 : 0
        const floodMultiplier = e.maxS >= 0.66 ? 4.0 : e.maxS >= 0.33 ? 2.0 : 0.0
        return e.lengthM * (1.0 + floodMultiplier) + underpassPenalty
      }
    )

    // 3. Balanced Route
    // Moderate penalty to balance detour length with flood hazard avoidance
    const balancedPath = this.findPath(
      originSnap.nodeId,
      destSnap.nodeId,
      (e) => {
        const underpassPenalty = e.isUnderpass ? 1000 : 0
        const floodMultiplier = e.maxS >= 0.66 ? 1.8 : 0.4
        return e.lengthM * (1.0 + floodMultiplier) + underpassPenalty
      }
    )

    // Helper to extract unique preserved segment IDs in traversal order
    const extractSegmentIds = (edges: RoutingEdge[]): string[] => {
      const ids: string[] = []
      let last = ''
      for (const e of edges) {
        if (e.segmentId && e.segmentId !== last) {
          ids.push(e.segmentId)
          last = e.segmentId
        }
      }
      return ids
    }

    const candidates: CandidateRouteInput[] = [
      {
        routeId: 'route-shortest',
        name: 'Shortest Distance Route',
        description: 'Direct shortest path following connected road network segments',
        mode: 'shortest',
        segmentIds: extractSegmentIds(shortestPath.pathEdges),
        coordinates: shortestPath.pathCoords,
      },
    ]

    // Only add safest option if it differs meaningfully or if it's the requested mode
    if (safestPath) {
      candidates.push({
        routeId: 'route-lower-exposure',
        name: 'Lower Modeled Exposure',
        description: 'Avoids known railway underpasses and macro-catchment runoff accumulation zones',
        mode: 'lower_exposure',
        segmentIds: extractSegmentIds(safestPath.pathEdges),
        coordinates: safestPath.pathCoords,
      })
    }

    if (balancedPath) {
      candidates.push({
        routeId: 'route-balanced',
        name: 'Balanced Flood-Aware Route',
        description: 'Balances travel distance against severe flood chokepoints',
        mode: 'balanced',
        segmentIds: extractSegmentIds(balancedPath.pathEdges),
        coordinates: balancedPath.pathCoords,
      })
    }

    // Evaluate all candidates using the established road-risk engine
    const comparison = await roadRiskService.evaluateCandidateRoutes(candidates, cityId)

    return {
      cityId,
      origin: {
        coordinates: request.origin,
        name: request.originName || 'Origin',
        snappedNodeId: originSnap.nodeId,
        snapDistanceM: originSnap.distanceMeters,
      },
      destination: {
        coordinates: request.destination,
        name: request.destinationName || 'Destination',
        snappedNodeId: destSnap.nodeId,
        snapDistanceM: destSnap.distanceMeters,
      },
      routes: comparison.rankedRoutes,
      comparison,
      scientificCaveat:
        'Routes are generated over Amritsar topological road segments and evaluated against 250m susceptibility and documented observations. Does NOT guarantee absence of surface water or passable clearance.',
      speedAssumptionNotice:
        'Travel times are estimated at a uniform 30 km/h urban baseline without live traffic, signal timing, or turn restriction models.',
    }
  }
}

export const roadRoutingEngine = RoadRoutingEngine.getInstance()
