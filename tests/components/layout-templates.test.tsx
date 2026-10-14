import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Layouts
import {
  AppShell,
  SidebarLayout,
  TopNavLayout,
  DashboardLayout,
  SettingsLayout,
  AuthLayout,
  MarketingLayout,
  PageHeader,
} from '@/components/layout'

// Templates
import {
  DashboardOverviewTemplate,
  ListPageTemplate,
  DetailPageTemplate,
  FormPageTemplate,
  SettingsPageTemplate,
  SearchResultsTemplate,
  MultiStepWorkflowTemplate,
  AuthPageTemplate,
} from '@/components/templates'

// States
import {
  PermissionDeniedState,
  NotFoundState,
  PageSkeletonState,
  UnsavedChangesBanner,
} from '@/components/ui/state-views'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/dashboard'),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}))

describe('Page-Level States', () => {
  it('renders PermissionDeniedState with action button and triggers callback', () => {
    const handleBack = vi.fn()
    render(
      <PermissionDeniedState
        title="Restricted Area"
        description="Requires administrator access"
        actionLabel="Go to Dashboard"
        onAction={handleBack}
      />
    )
    expect(screen.getByTestId('permission-denied-state')).toBeInTheDocument()
    expect(screen.getByText('Restricted Area')).toBeInTheDocument()
    expect(screen.getByText('Requires administrator access')).toBeInTheDocument()

    const btn = screen.getByRole('button', { name: 'Go to Dashboard' })
    fireEvent.click(btn)
    expect(handleBack).toHaveBeenCalledTimes(1)
  })

  it('renders NotFoundState with action button and triggers callback', () => {
    const handleReturn = vi.fn()
    render(
      <NotFoundState
        title="Item Not Found"
        description="The requested project was not found."
        actionLabel="Back to Projects"
        onAction={handleReturn}
      />
    )
    expect(screen.getByTestId('not-found-state')).toBeInTheDocument()
    expect(screen.getByText('Item Not Found')).toBeInTheDocument()

    const btn = screen.getByRole('button', { name: 'Back to Projects' })
    fireEvent.click(btn)
    expect(handleReturn).toHaveBeenCalledTimes(1)
  })

  it('renders PageSkeletonState with configurable card count', () => {
    render(<PageSkeletonState cardsCount={5} />)
    expect(screen.getByTestId('page-skeleton-state')).toBeInTheDocument()
  })

  it('renders UnsavedChangesBanner only when changes exist and triggers discard and save', () => {
    const handleDiscard = vi.fn()
    const handleSave = vi.fn()

    const { rerender } = render(
      <UnsavedChangesBanner
        hasChanges={false}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    )
    expect(screen.queryByTestId('unsaved-changes-banner')).not.toBeInTheDocument()

    rerender(
      <UnsavedChangesBanner
        hasChanges={true}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    )
    expect(screen.getByTestId('unsaved-changes-banner')).toBeInTheDocument()
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()

    const discardBtn = screen.getByRole('button', { name: /discard/i })
    fireEvent.click(discardBtn)
    expect(handleDiscard).toHaveBeenCalledTimes(1)

    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    fireEvent.click(saveBtn)
    expect(handleSave).toHaveBeenCalledTimes(1)
  })
})

describe('PageHeader Component', () => {
  it('renders title, description, badge, and action buttons', () => {
    render(
      <PageHeader
        title="Settings & Preferences"
        description="Workspace configuration options"
        badge={<span data-testid="test-badge">Beta</span>}
        actions={<button>Export</button>}
      />
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Settings & Preferences')
    expect(screen.getByText('Workspace configuration options')).toBeInTheDocument()
    expect(screen.getByTestId('test-badge')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })

  it('renders accessible breadcrumbs navigation and active current page', () => {
    render(
      <PageHeader
        title="Billing History"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Settings', href: '/settings' },
          { label: 'Billing' },
        ]}
      />
    )
    const breadcrumbNav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(breadcrumbNav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.getByText('Billing')).toHaveAttribute('aria-current', 'page')
  })

  it('renders back navigation button when backHref is provided without breadcrumbs', () => {
    render(
      <PageHeader
        title="Edit Record"
        backHref="/records"
        backLabel="Back to list"
      />
    )
    const backLink = screen.getByRole('link', { name: /back to list/i })
    expect(backLink).toHaveAttribute('href', '/records')
  })
})

describe('Application Layouts', () => {
  it('renders AppShell with custom header, sidebar, content, and footer slots', () => {
    render(
      <AppShell
        header={<div data-testid="shell-header">Header Slot</div>}
        sidebar={<div data-testid="shell-sidebar">Sidebar Slot</div>}
        footer={<div data-testid="shell-footer">Footer Slot</div>}
      >
        <div data-testid="shell-content">Main App Content</div>
      </AppShell>
    )
    expect(screen.getByTestId('shell-header')).toBeInTheDocument()
    expect(screen.getByTestId('shell-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('shell-footer')).toBeInTheDocument()
    expect(screen.getByTestId('shell-content')).toBeInTheDocument()
  })

  it('renders SidebarLayout with responsive sidebar, nav items, user badge, and mobile drawer toggle', () => {
    const navItems = [
      { title: 'Overview', href: '/dashboard', active: true },
      { title: 'Projects', href: '/dashboard/projects' },
      { title: 'Disabled Tab', href: '/disabled', disabled: true },
    ]

    render(
      <SidebarLayout
        navItems={navItems}
        user={{ email: 'tester@example.com' }}
        headerTitle="Team Workspace"
      >
        <div>Dashboard Area</div>
      </SidebarLayout>
    )

    // Checks navigation items & accessibility
    expect(screen.getByText('Team Workspace')).toBeInTheDocument()
    expect(screen.getByText('tester@example.com')).toBeInTheDocument()
    const overviewLink = screen.getByRole('link', { name: /overview/i })
    expect(overviewLink).toHaveAttribute('aria-current', 'page')

    // Mobile menu toggle
    const mobileMenuBtn = screen.getByRole('button', { name: /open sidebar/i })
    expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(mobileMenuBtn)
    expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'true')

    // Backdrop should be present when drawer opened
    const backdrop = screen.getByTestId('sidebar-backdrop')
    expect(backdrop).toBeInTheDocument()

    // Clicking backdrop closes drawer
    fireEvent.click(backdrop)
    expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument()
  })

  it('closes SidebarLayout drawer on Escape key press', () => {
    render(
      <SidebarLayout
        navItems={[{ title: 'Overview', href: '/dashboard' }]}
      >
        <div>Content</div>
      </SidebarLayout>
    )

    const mobileMenuBtn = screen.getByRole('button', { name: /open sidebar/i })
    fireEvent.click(mobileMenuBtn)
    expect(screen.getByTestId('sidebar-backdrop')).toBeInTheDocument()

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument()
  })

  it('renders TopNavLayout with brand, links, user and action buttons', () => {
    render(
      <TopNavLayout
        brand={{ name: 'CloudApp', href: '/' }}
        navItems={[
          { title: 'Home', href: '/' },
          { title: 'Docs', href: '/docs' },
        ]}
        user={{ email: 'user@cloud.com' }}
        actions={<button>Sign Out</button>}
      >
        <div>TopNav Page Body</div>
      </TopNavLayout>
    )

    expect(screen.getByText('CloudApp')).toBeInTheDocument()
    expect(screen.getByText('user@cloud.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument()
    expect(screen.getByText('TopNav Page Body')).toBeInTheDocument()
  })

  it('renders DashboardLayout with structured header and content', () => {
    render(
      <DashboardLayout
        title="System Analytics"
        description="Live server stats"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Analytics' }]}
        actions={<button>Refresh Data</button>}
      >
        <div data-testid="dashboard-analytics-content">Chart Grid</div>
      </DashboardLayout>
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('System Analytics')
    expect(screen.getByText('Live server stats')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh Data' })).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-analytics-content')).toBeInTheDocument()
  })

  it('renders SettingsLayout with section tabs and triggers onSectionChange', () => {
    const handleSectionChange = vi.fn()
    const sections = [
      { id: 'general', label: 'General Profile' },
      { id: 'security', label: 'Security & Auth' },
      { id: 'billing', label: 'Billing Details' },
    ]

    render(
      <SettingsLayout
        sections={sections}
        activeSection="general"
        onSectionChange={handleSectionChange}
      >
        <div>General Settings Content</div>
      </SettingsLayout>
    )

    expect(screen.getByText('General Settings Content')).toBeInTheDocument()
    const secBtn = screen.getByRole('button', { name: /security & auth/i })
    fireEvent.click(secBtn)
    expect(handleSectionChange).toHaveBeenCalledWith('security')
  })

  it('renders AuthLayout with centered brand card and footer', () => {
    render(
      <AuthLayout
        brandName="SecurePortal"
        backHref="/home"
        backLabel="Back"
        footer={<span>Terms of Service</span>}
      >
        <form data-testid="auth-form-slot">
          <input placeholder="Email" />
        </form>
      </AuthLayout>
    )

    expect(screen.getByText('SecurePortal')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/home')
    expect(screen.getByTestId('auth-form-slot')).toBeInTheDocument()
    expect(screen.getByText('Terms of Service')).toBeInTheDocument()
  })

  it('renders MarketingLayout with navbar, hero, children, and footer', () => {
    render(
      <MarketingLayout
        navbar={<nav data-testid="m-nav">Nav</nav>}
        hero={<section data-testid="m-hero">Hero Section</section>}
        footer={<footer data-testid="m-footer">Footer Content</footer>}
      >
        <div>Features Grid</div>
      </MarketingLayout>
    )

    expect(screen.getByTestId('m-nav')).toBeInTheDocument()
    expect(screen.getByTestId('m-hero')).toBeInTheDocument()
    expect(screen.getByTestId('m-footer')).toBeInTheDocument()
    expect(screen.getByText('Features Grid')).toBeInTheDocument()
  })
})

describe('Page Templates', () => {
  it('DashboardOverviewTemplate renders stats, positive/negative changes, and main content', () => {
    const stats = [
      { title: 'Total Revenue', value: '$45,231', change: '+12%', changeType: 'positive' as const },
      { title: 'Error Rate', value: '0.04%', change: '-2%', changeType: 'negative' as const },
      { title: 'Uptime', value: '99.98%', change: '0%', changeType: 'neutral' as const },
    ]

    render(
      <DashboardOverviewTemplate
        title="Company Pulse"
        stats={stats}
        mainContent={<div data-testid="pulse-charts">Sales Charts</div>}
        sideContent={<div data-testid="pulse-activity">Activity Feed</div>}
      />
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Company Pulse')
    expect(screen.getByText('$45,231')).toBeInTheDocument()
    expect(screen.getByText('+12%')).toBeInTheDocument()
    expect(screen.getByText('0.04%')).toBeInTheDocument()
    expect(screen.getByTestId('pulse-charts')).toBeInTheDocument()
    expect(screen.getByTestId('pulse-activity')).toBeInTheDocument()
  })

  it('DashboardOverviewTemplate renders loading and error states properly', () => {
    const handleRetry = vi.fn()
    const { rerender } = render(
      <DashboardOverviewTemplate
        isLoading={true}
        mainContent={<div>Content</div>}
      />
    )
    expect(screen.getByTestId('page-skeleton-state')).toBeInTheDocument()

    rerender(
      <DashboardOverviewTemplate
        error="Could not connect to database"
        onRetry={handleRetry}
        mainContent={<div>Content</div>}
      />
    )
    expect(screen.getByTestId('error-state')).toBeInTheDocument()
    expect(screen.getByText('Could not connect to database')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it('ListPageTemplate renders search, triggers search change, renders primary action and empty state', () => {
    const handleSearch = vi.fn()
    const handleCreate = vi.fn()

    const { rerender } = render(
      <ListPageTemplate
        title="Products"
        primaryAction={{ label: 'New Product', onClick: handleCreate }}
        searchQuery="laptop"
        onSearchChange={handleSearch}
        isEmpty={false}
      >
        <div data-testid="products-table">Products Table</div>
      </ListPageTemplate>
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Products')
    expect(screen.getByTestId('products-table')).toBeInTheDocument()

    // Primary action
    const createBtn = screen.getByRole('button', { name: 'New Product' })
    fireEvent.click(createBtn)
    expect(handleCreate).toHaveBeenCalledTimes(1)

    // Search input
    const searchInput = screen.getByPlaceholderText(/search records/i)
    fireEvent.change(searchInput, { target: { value: 'phone' } })
    expect(handleSearch).toHaveBeenCalledWith('phone')

    // Empty state
    rerender(
      <ListPageTemplate
        title="Products"
        isEmpty={true}
        emptyTitle="No products match"
        primaryAction={{ label: 'New Product', onClick: handleCreate }}
      >
        <div data-testid="products-table">Products Table</div>
      </ListPageTemplate>
    )
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('No products match')).toBeInTheDocument()
    expect(screen.queryByTestId('products-table')).not.toBeInTheDocument()
  })

  it('DetailPageTemplate renders header, tabs, active tab click, and metadata sidebar', () => {
    const handleTabChange = vi.fn()
    const tabs = [
      { id: 'overview', label: 'Overview', count: 1 },
      { id: 'logs', label: 'Audit Logs', count: 42 },
    ]

    render(
      <DetailPageTemplate
        title="Order #9021"
        backHref="/orders"
        backLabel="Orders"
        badges={<span data-testid="order-badge">Fulfilled</span>}
        tabs={tabs}
        activeTab="overview"
        onTabChange={handleTabChange}
        sidebar={<div data-testid="order-sidebar">Customer Details</div>}
      >
        <div data-testid="order-content">Order Items Table</div>
      </DetailPageTemplate>
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Order #9021')
    expect(screen.getByTestId('order-badge')).toBeInTheDocument()
    expect(screen.getByTestId('order-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('order-content')).toBeInTheDocument()

    const logsTab = screen.getByRole('button', { name: /audit logs/i })
    fireEvent.click(logsTab)
    expect(handleTabChange).toHaveBeenCalledWith('logs')
  })

  it('FormPageTemplate handles submit, cancel, submitting state, and unsaved changes banner', () => {
    const handleSubmit = vi.fn((e) => e.preventDefault())
    const handleCancel = vi.fn()
    const handleDiscard = vi.fn()

    const { rerender } = render(
      <FormPageTemplate
        title="Edit Profile"
        description="Update your account details"
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        hasUnsavedChanges={true}
        onDiscardChanges={handleDiscard}
      >
        <input placeholder="Full Name" />
      </FormPageTemplate>
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Edit Profile')
    expect(screen.getByTestId('unsaved-changes-banner')).toBeInTheDocument()

    // Cancel action
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)
    expect(handleCancel).toHaveBeenCalledTimes(1)

    // Submit action
    const submitBtn = screen.getByRole('button', { name: 'Save changes' })
    fireEvent.click(submitBtn)
    expect(handleSubmit).toHaveBeenCalledTimes(1)

    // Submitting state disables buttons
    rerender(
      <FormPageTemplate
        title="Edit Profile"
        isSubmitting={true}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      >
        <input placeholder="Full Name" />
      </FormPageTemplate>
    )
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('SettingsPageTemplate renders sections and switches active view', () => {
    const handleSection = vi.fn()
    const sections = [
      { id: 'profile', label: 'User Profile' },
      { id: 'notifications', label: 'Notifications' },
    ]

    render(
      <SettingsPageTemplate
        sections={sections}
        activeSection="profile"
        onSectionChange={handleSection}
      >
        <div data-testid="profile-form">Profile Settings Fields</div>
      </SettingsPageTemplate>
    )

    expect(screen.getByTestId('profile-form')).toBeInTheDocument()
    const notifBtn = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(notifBtn)
    expect(handleSection).toHaveBeenCalledWith('notifications')
  })

  it('SearchResultsTemplate renders query, sort options, and empty search results', () => {
    const handleQueryChange = vi.fn()
    const handleSortChange = vi.fn()

    const { rerender } = render(
      <SearchResultsTemplate
        query="database"
        onQueryChange={handleQueryChange}
        totalResults={3}
        sortOptions={[
          { label: 'Most Relevant', value: 'relevant' },
          { label: 'Newest', value: 'newest' },
        ]}
        activeSort="relevant"
        onSortChange={handleSortChange}
      >
        <div data-testid="search-results-list">3 Results Listed</div>
      </SearchResultsTemplate>
    )

    expect(screen.getByText(/3 results for "database"/i)).toBeInTheDocument()
    expect(screen.getByTestId('search-results-list')).toBeInTheDocument()

    // Empty search result
    rerender(
      <SearchResultsTemplate
        query="xyzunknown"
        onQueryChange={handleQueryChange}
        totalResults={0}
      >
        <div data-testid="search-results-list">None</div>
      </SearchResultsTemplate>
    )
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText(/couldn't find anything matching "xyzunknown"/i)).toBeInTheDocument()
  })

  it('MultiStepWorkflowTemplate renders stepper, current step badge, Next/Back/Finish navigation', () => {
    const handleNext = vi.fn()
    const handleBack = vi.fn()
    const handleFinish = vi.fn()

    const steps = [
      { id: 'step-1', title: 'Target Info', description: 'Set target URL' },
      { id: 'step-2', title: 'Parameters', description: 'Configure headers' },
      { id: 'step-3', title: 'Review & Run', description: 'Confirm execution' },
    ]

    // Step 1: First step (Back disabled, Continue visible)
    const { rerender } = render(
      <MultiStepWorkflowTemplate
        title="New API Probe"
        steps={steps}
        currentStepIndex={0}
        onNext={handleNext}
        onBack={handleBack}
        onFinish={handleFinish}
      >
        <div data-testid="step-1-content">Step 1 Form</div>
      </MultiStepWorkflowTemplate>
    )

    expect(screen.getByTestId('step-1-content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    const continueBtn = screen.getByRole('button', { name: /continue/i })
    fireEvent.click(continueBtn)
    expect(handleNext).toHaveBeenCalledTimes(1)

    // Step 2: Middle step
    rerender(
      <MultiStepWorkflowTemplate
        title="New API Probe"
        steps={steps}
        currentStepIndex={1}
        onNext={handleNext}
        onBack={handleBack}
        onFinish={handleFinish}
      >
        <div data-testid="step-2-content">Step 2 Form</div>
      </MultiStepWorkflowTemplate>
    )
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(handleBack).toHaveBeenCalledTimes(1)

    // Step 3: Last step (Finish button instead of Continue)
    rerender(
      <MultiStepWorkflowTemplate
        title="New API Probe"
        steps={steps}
        currentStepIndex={2}
        finishLabel="Launch Probe"
        onNext={handleNext}
        onBack={handleBack}
        onFinish={handleFinish}
      >
        <div data-testid="step-3-content">Step 3 Review</div>
      </MultiStepWorkflowTemplate>
    )
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument()
    const finishBtn = screen.getByRole('button', { name: 'Launch Probe' })
    fireEvent.click(finishBtn)
    expect(handleFinish).toHaveBeenCalledTimes(1)
  })

  it('AuthPageTemplate renders title, description, error and navigation links', () => {
    render(
      <AuthPageTemplate
        title="Welcome Back"
        description="Sign in to your account"
        error="Invalid email or password"
        links={[
          { text: "Don't have an account?", linkText: 'Sign up', href: '/signup' },
        ]}
      >
        <div data-testid="login-inputs">Inputs</div>
      </AuthPageTemplate>
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome Back')
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup')
    expect(screen.getByTestId('login-inputs')).toBeInTheDocument()
  })
})
