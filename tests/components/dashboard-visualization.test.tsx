import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  MetricCard,
  LineChart,
  BarChart,
  AreaChart,
  DonutChart,
  PaginatedDataTable,
  DashboardHeader,
  DateRangeFilter,
  DemoDashboard,
} from '@/components/visualization'
import { ColumnDef } from '@/components/ui/table'

describe('Data Visualization & Dashboard Toolkit (Component Tests)', () => {
  describe('MetricCard', () => {
    it('renders KPI title, formatted value, and positive trend delta', () => {
      render(
        <MetricCard
          title="Monthly Revenue"
          value="$124,500"
          change={14.2}
          previousValue="$109,000"
          sparklineData={[100, 110, 115, 124.5]}
        />
      )

      expect(screen.getByText('Monthly Revenue')).toBeInTheDocument()
      expect(screen.getByText('$124,500')).toBeInTheDocument()
      expect(screen.getByText('14.2%')).toBeInTheDocument()
      expect(screen.getByText(/from \$109,000/)).toBeInTheDocument()
    })

    it('renders negative trend delta appropriately', () => {
      render(
        <MetricCard
          title="Churn Rate"
          value="2.1%"
          change={-5.4}
        />
      )

      expect(screen.getByText('Churn Rate')).toBeInTheDocument()
      expect(screen.getByText('5.4%')).toBeInTheDocument()
    })

    it('renders loading skeleton and error states', () => {
      const { rerender } = render(
        <MetricCard title="Loading Metric" value="0" loading={true} />
      )
      expect(screen.getByTestId('metric-card-loading')).toBeInTheDocument()

      rerender(
        <MetricCard title="Failed Metric" value="0" error="Service unavailable" />
      )
      expect(screen.getByTestId('metric-card-error')).toBeInTheDocument()
      expect(screen.getByText('Service unavailable')).toBeInTheDocument()
    })
  })

  describe('LineChart', () => {
    const mockData = [
      { label: 'Jan', value: 100 },
      { label: 'Feb', value: 150 },
      { label: 'Mar', value: 200 },
    ]

    it('renders SVG line chart with title and data points', () => {
      render(
        <LineChart
          title="User Signups"
          description="Quarterly trajectory"
          data={mockData}
        />
      )

      expect(screen.getByText('User Signups')).toBeInTheDocument()
      expect(screen.getByText('Quarterly trajectory')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: /User Signups/i })).toBeInTheDocument()
      expect(screen.getByText('Jan')).toBeInTheDocument()
      expect(screen.getByText('Mar')).toBeInTheDocument()
    })

    it('renders empty and loading states', () => {
      const { rerender } = render(
        <LineChart data={[]} title="Empty Chart" />
      )
      expect(screen.getByTestId('line-chart-empty')).toBeInTheDocument()

      rerender(
        <LineChart data={mockData} title="Loading Chart" loading={true} />
      )
      expect(screen.getByTestId('line-chart-loading')).toBeInTheDocument()
    })
  })

  describe('BarChart', () => {
    const mockData = [
      { label: 'Region A', value: 50 },
      { label: 'Region B', value: 80 },
    ]

    it('renders bar chart with comparison categories', () => {
      render(
        <BarChart
          title="Regional Performance"
          data={mockData}
        />
      )

      expect(screen.getByText('Regional Performance')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: /Regional Performance/i })).toBeInTheDocument()
      expect(screen.getByText('Region A')).toBeInTheDocument()
      expect(screen.getByText('Region B')).toBeInTheDocument()
    })

    it('renders error state on chart failure', () => {
      render(
        <BarChart
          data={mockData}
          error="Failed to load telemetry"
        />
      )
      expect(screen.getByTestId('bar-chart-error')).toBeInTheDocument()
      expect(screen.getByText('Failed to load telemetry')).toBeInTheDocument()
    })
  })

  describe('AreaChart', () => {
    const mockData = [
      { label: '01:00', value: 10 },
      { label: '02:00', value: 25 },
      { label: '03:00', value: 40 },
    ]

    it('renders area chart with gradient and path', () => {
      render(
        <AreaChart
          title="Throughput"
          data={mockData}
        />
      )

      expect(screen.getByText('Throughput')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: /Throughput/i })).toBeInTheDocument()
      expect(screen.getByText('01:00')).toBeInTheDocument()
      expect(screen.getByText('03:00')).toBeInTheDocument()
    })
  })

  describe('DonutChart', () => {
    const mockData = [
      { label: 'Desktop', value: 60 },
      { label: 'Mobile', value: 30 },
      { label: 'Tablet', value: 10 },
    ]

    it('renders donut chart with center metric and legend', () => {
      render(
        <DonutChart
          title="Traffic Breakdown"
          data={mockData}
          centerLabel="Devices"
        />
      )

      expect(screen.getByText('Traffic Breakdown')).toBeInTheDocument()
      expect(screen.getByText('Devices')).toBeInTheDocument()
      expect(screen.getByText('Desktop')).toBeInTheDocument()
      expect(screen.getByText('Mobile')).toBeInTheDocument()
      expect(screen.getByText('60.0%')).toBeInTheDocument()
      expect(screen.getByText('30.0%')).toBeInTheDocument()
    })
  })

  describe('PaginatedDataTable', () => {
    interface TestRow {
      id: string
      name: string
      score: number
    }

    const testRows: TestRow[] = [
      { id: '1', name: 'Alice', score: 95 },
      { id: '2', name: 'Bob', score: 82 },
      { id: '3', name: 'Charlie', score: 88 },
      { id: '4', name: 'Diana', score: 91 },
      { id: '5', name: 'Evan', score: 76 },
      { id: '6', name: 'Frank', score: 84 },
    ]

    const columns: ColumnDef<TestRow>[] = [
      { key: 'id', header: 'ID', accessor: (r) => r.id },
      { key: 'name', header: 'Name', accessor: (r) => r.name, sortable: true, sortValue: (r) => r.name },
      { key: 'score', header: 'Score', accessor: (r) => r.score, sortable: true, sortValue: (r) => r.score },
    ]

    it('renders table rows with pagination and row count indicator', () => {
      render(
        <PaginatedDataTable
          title="Students"
          data={testRows}
          columns={columns}
          keyExtractor={(r) => r.id}
          pageSize={3}
        />
      )

      expect(screen.getByText('Students')).toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()
      expect(screen.queryByText('Diana')).not.toBeInTheDocument()

      expect(screen.getByText(/Showing 1 to 3 of 6 entries/i)).toBeInTheDocument()

      // Click Next page
      const nextBtn = screen.getByRole('button', { name: /Next/i })
      fireEvent.click(nextBtn)

      expect(screen.getByText('Diana')).toBeInTheDocument()
      expect(screen.getByText('Evan')).toBeInTheDocument()
    })

    it('filters rows via search input', () => {
      render(
        <PaginatedDataTable
          data={testRows}
          columns={columns}
          keyExtractor={(r) => r.id}
          pageSize={10}
        />
      )

      const searchInput = screen.getByLabelText('Filter records')
      fireEvent.change(searchInput, { target: { value: 'Diana' } })

      expect(screen.getByText('Diana')).toBeInTheDocument()
      expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    })
  })

  describe('DashboardHeader and DateRangeFilter', () => {
    it('handles refresh button and preset selection callback', () => {
      const handleRefresh = vi.fn()
      const handlePresetChange = vi.fn()

      render(
        <DashboardHeader
          title="Telemetry Center"
          description="Overview of performance"
          onRefresh={handleRefresh}
          actions={
            <DateRangeFilter
              activePreset="30d"
              onPresetChange={handlePresetChange}
            />
          }
        />
      )

      expect(screen.getByText('Telemetry Center')).toBeInTheDocument()
      expect(screen.getByText('Overview of performance')).toBeInTheDocument()

      const refreshBtn = screen.getByRole('button', { name: /Refresh dashboard data/i })
      fireEvent.click(refreshBtn)
      expect(handleRefresh).toHaveBeenCalledTimes(1)

      const preset7d = screen.getByRole('button', { name: '7D' })
      fireEvent.click(preset7d)
      expect(handlePresetChange).toHaveBeenCalledWith('7d')
    })
  })

  describe('DemoDashboard', () => {
    it('renders the complete integrated demo dashboard', () => {
      render(<DemoDashboard />)

      expect(screen.getByTestId('demo-dashboard')).toBeInTheDocument()
      expect(screen.getByText(/Analytics & Performance Dashboard/i)).toBeInTheDocument()
      expect(screen.getByText('[DEMO FIXTURE]')).toBeInTheDocument()
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
      expect(screen.getByText('Active Users')).toBeInTheDocument()
      expect(screen.getByText('Revenue Growth Trend')).toBeInTheDocument()
      expect(screen.getByText('Regional Breakdown')).toBeInTheDocument()
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
    })
  })
})
