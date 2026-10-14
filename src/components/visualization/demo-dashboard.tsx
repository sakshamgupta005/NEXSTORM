'use client'

import * as React from 'react'
import {
  DollarSign,
  Users,
  Activity,
  Zap,
  TrendingUp,
} from 'lucide-react'
import {
  MetricCard,
  LineChart,
  BarChart,
  AreaChart,
  DonutChart,
  PaginatedDataTable,
  DashboardHeader,
  DashboardGrid,
  DashboardSection,
  DateRangeFilter,
} from '@/components/visualization'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDate,
} from '@/lib/visualization/formatters'
import { PresetDateRange, ChartDataPoint } from '@/lib/visualization/types'
import { Badge } from '@/components/ui/badge'
import { ColumnDef } from '@/components/ui/table'

// Deterministic mock datasets labeled explicitly as demo fixtures
export const DEMO_KPI_DATA = {
  revenue: { value: 124850, previous: 108500, change: 15.1, sparkline: [95, 102, 108, 115, 120, 124.8] },
  users: { value: 14200, previous: 12900, change: 10.1, sparkline: [12, 12.5, 13.1, 13.4, 13.8, 14.2] },
  conversion: { value: 3.42, previous: 3.65, change: -6.3, sparkline: [3.8, 3.7, 3.5, 3.6, 3.5, 3.42] },
  latency: { value: 145, previous: 160, change: -9.4, sparkline: [160, 155, 150, 152, 148, 145] },
}

export const DEMO_LINE_SERIES: ChartDataPoint[] = [
  { label: 'Jan', value: 32000 },
  { label: 'Feb', value: 41000 },
  { label: 'Mar', value: 48000 },
  { label: 'Apr', value: 52000 },
  { label: 'May', value: 69000 },
  { label: 'Jun', value: 78000 },
  { label: 'Jul', value: 92000 },
  { label: 'Aug', value: 105000 },
  { label: 'Sep', value: 114000 },
  { label: 'Oct', value: 124850 },
]

export const DEMO_BAR_SERIES: ChartDataPoint[] = [
  { label: 'North America', value: 54000, color: '#2563eb' },
  { label: 'Europe', value: 38000, color: '#0d9488' },
  { label: 'Asia-Pacific', value: 24000, color: '#d97706' },
  { label: 'Latin America', value: 8500, color: '#7c3aed' },
  { label: 'Middle East', value: 4300, color: '#e11d48' },
]

export const DEMO_AREA_SERIES: ChartDataPoint[] = [
  { label: '00:00', value: 120 },
  { label: '04:00', value: 85 },
  { label: '08:00', value: 450 },
  { label: '12:00', value: 890 },
  { label: '16:00', value: 760 },
  { label: '20:00', value: 540 },
  { label: '23:59', value: 210 },
]

export const DEMO_DONUT_SERIES: ChartDataPoint[] = [
  { label: 'Organic Search', value: 45 },
  { label: 'Direct Referral', value: 25 },
  { label: 'Social Media', value: 18 },
  { label: 'Email Campaigns', value: 12 },
]

export interface DemoTransaction {
  id: string
  customer: string
  plan: string
  amount: number
  status: 'Completed' | 'Pending' | 'Failed'
  date: string
}

export const DEMO_TRANSACTIONS: DemoTransaction[] = [
  { id: 'TX-1001', customer: 'Acme Corp', plan: 'Enterprise', amount: 4999, status: 'Completed', date: '2026-10-10' },
  { id: 'TX-1002', customer: 'Globex Ltd', plan: 'Pro', amount: 1299, status: 'Completed', date: '2026-10-10' },
  { id: 'TX-1003', customer: 'Initech Systems', plan: 'Team', amount: 599, status: 'Pending', date: '2026-10-09' },
  { id: 'TX-1004', customer: 'Umbrella Bio', plan: 'Enterprise', amount: 4999, status: 'Completed', date: '2026-10-09' },
  { id: 'TX-1005', customer: 'Hooli Media', plan: 'Pro', amount: 1299, status: 'Failed', date: '2026-10-08' },
  { id: 'TX-1006', customer: 'Stark Industries', plan: 'Enterprise', amount: 7500, status: 'Completed', date: '2026-10-08' },
  { id: 'TX-1007', customer: 'Wayne Enterprises', plan: 'Enterprise', amount: 4999, status: 'Completed', date: '2026-10-07' },
  { id: 'TX-1008', customer: 'Cyberdyne AI', plan: 'Team', amount: 599, status: 'Completed', date: '2026-10-07' },
]

export function DemoDashboard() {
  const [activeRange, setActiveRange] = React.useState<PresetDateRange>('30d')
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [lastRefreshed, setLastRefreshed] = React.useState<Date>(new Date())

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
      setLastRefreshed(new Date())
    }, 600)
  }

  const tableColumns: ColumnDef<DemoTransaction>[] = [
    {
      key: 'id',
      header: 'ID',
      accessor: (item) => <span className="font-mono text-xs font-semibold">{item.id}</span>,
      sortable: true,
      sortValue: (item) => item.id,
    },
    {
      key: 'customer',
      header: 'Customer',
      accessor: (item) => item.customer,
      sortable: true,
      sortValue: (item) => item.customer,
    },
    {
      key: 'plan',
      header: 'Plan',
      accessor: (item) => (
        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {item.plan}
        </span>
      ),
      sortable: true,
      sortValue: (item) => item.plan,
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (item) => <span className="font-semibold">{formatCurrency(item.amount)}</span>,
      sortable: true,
      sortValue: (item) => item.amount,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (item) => (
        <Badge
          variant={
            item.status === 'Completed'
              ? 'success'
              : item.status === 'Pending'
              ? 'warning'
              : 'danger'
          }
        >
          {item.status}
        </Badge>
      ),
      sortable: true,
      sortValue: (item) => item.status,
    },
    {
      key: 'date',
      header: 'Date',
      accessor: (item) => formatDate(item.date, 'short'),
      sortable: true,
      sortValue: (item) => item.date,
    },
  ]

  return (
    <div className="space-y-6" data-testid="demo-dashboard">
      <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
        <TrendingUp className="h-4 w-4 shrink-0" />
        <span>
          <strong>[DEMO FIXTURE]</strong> This dashboard demonstrates reusable chart components, KPI cards, and data tables with deterministic mock data.
        </span>
      </div>

      <DashboardHeader
        title="Analytics & Performance Dashboard"
        description="Real-time application telemetry, financial metrics, and customer transactions."
        lastUpdated={lastRefreshed}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        actions={
          <DateRangeFilter
            activePreset={activeRange}
            onPresetChange={setActiveRange}
          />
        }
      />

      {/* KPI Metric Cards */}
      <DashboardGrid columns={4}>
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(DEMO_KPI_DATA.revenue.value)}
          change={DEMO_KPI_DATA.revenue.change}
          previousValue={formatCurrency(DEMO_KPI_DATA.revenue.previous)}
          icon={DollarSign}
          sparklineData={DEMO_KPI_DATA.revenue.sparkline}
        />
        <MetricCard
          title="Active Users"
          value={formatNumber(DEMO_KPI_DATA.users.value)}
          change={DEMO_KPI_DATA.users.change}
          previousValue={formatNumber(DEMO_KPI_DATA.users.previous)}
          icon={Users}
          sparklineData={DEMO_KPI_DATA.users.sparkline}
        />
        <MetricCard
          title="Conversion Rate"
          value={formatPercent(DEMO_KPI_DATA.conversion.value)}
          change={DEMO_KPI_DATA.conversion.change}
          previousValue={formatPercent(DEMO_KPI_DATA.conversion.previous)}
          icon={Activity}
          sparklineData={DEMO_KPI_DATA.conversion.sparkline}
        />
        <MetricCard
          title="Avg P95 Latency"
          value={`${DEMO_KPI_DATA.latency.value}ms`}
          change={DEMO_KPI_DATA.latency.change}
          trend="up" // latency reduction is good
          previousValue={`${DEMO_KPI_DATA.latency.previous}ms`}
          icon={Zap}
          sparklineData={DEMO_KPI_DATA.latency.sparkline}
        />
      </DashboardGrid>

      {/* Charts Grid */}
      <DashboardGrid columns={2}>
        <LineChart
          title="Revenue Growth Trend"
          description="Monthly recurring subscription revenue"
          data={DEMO_LINE_SERIES}
          formatValue={(v) => formatCurrency(v, { notation: 'compact' })}
          curve="smooth"
        />
        <BarChart
          title="Regional Breakdown"
          description="Customer accounts categorized by geographic territory"
          data={DEMO_BAR_SERIES}
          formatValue={(v) => formatNumber(v, { notation: 'compact' })}
        />
      </DashboardGrid>

      <DashboardGrid columns={2}>
        <AreaChart
          title="API Request Volumes"
          description="Requests processed over 24-hour cycle"
          data={DEMO_AREA_SERIES}
          color="#0d9488"
          formatValue={(v) => `${v} req/s`}
        />
        <DonutChart
          title="Acquisition Channels"
          description="User acquisition breakdown by source"
          data={DEMO_DONUT_SERIES}
          formatValue={(v) => `${v}%`}
        />
      </DashboardGrid>

      {/* Paginated Transactions Table */}
      <DashboardSection
        title="Recent Transactions"
        description="Filterable customer activity with live sorting and pagination"
      >
        <PaginatedDataTable
          data={DEMO_TRANSACTIONS}
          columns={tableColumns}
          keyExtractor={(item) => item.id}
          pageSize={5}
          searchPlaceholder="Filter transactions by customer or plan..."
        />
      </DashboardSection>
    </div>
  )
}
