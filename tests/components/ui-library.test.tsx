import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import * as React from 'react'
import {
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
  Switch,
  FormField,
  Skeleton,
  Spinner,
  Dialog,
  ConfirmDialog,
  ToastProvider,
  useToast,
  SearchInput,
  Pagination,
  DataTable,
  FileUpload,
} from '@/components/ui'

describe('Form Controls & Fields', () => {
  it('renders Textarea with value and inline error', () => {
    render(
      <Textarea
        id="bio"
        placeholder="Tell us about yourself"
        error="Bio is required"
      />
    )
    const textarea = screen.getByPlaceholderText(/tell us about yourself/i)
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Bio is required')
  })

  it('renders Select with options and handles selection change', () => {
    const handleChange = vi.fn()
    render(
      <Select
        id="role"
        options={[
          { value: 'admin', label: 'Administrator' },
          { value: 'user', label: 'Standard User' },
        ]}
        placeholder="Select a role"
        onChange={handleChange}
      />
    )

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'admin' } })
    expect(handleChange).toHaveBeenCalled()
    expect(screen.getByText('Administrator')).toBeInTheDocument()
  })

  it('renders Checkbox and handles toggle state', () => {
    const handleChange = vi.fn()
    render(
      <Checkbox
        id="terms"
        label="Accept terms"
        description="Must be accepted to continue"
        onChange={handleChange}
      />
    )

    const checkbox = screen.getByRole('checkbox', { name: /accept terms/i })
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(handleChange).toHaveBeenCalled()
    expect(screen.getByText('Must be accepted to continue')).toBeInTheDocument()
  })

  it('renders RadioGroup and handles option selection', () => {
    const handleChange = vi.fn()
    render(
      <RadioGroup
        name="plan"
        label="Choose Plan"
        options={[
          { value: 'free', label: 'Free Tier' },
          { value: 'pro', label: 'Pro Tier' },
        ]}
        defaultValue="free"
        onChange={handleChange}
      />
    )

    const freeRadio = screen.getByRole('radio', { name: /free tier/i })
    const proRadio = screen.getByRole('radio', { name: /pro tier/i })

    expect(freeRadio).toBeChecked()
    expect(proRadio).not.toBeChecked()

    fireEvent.click(proRadio)
    expect(handleChange).toHaveBeenCalled()
  })

  it('renders Switch and toggles via click and keyboard (Space/Enter)', () => {
    const handleToggle = vi.fn()
    render(<Switch id="notifications" label="Enable alerts" onCheckedChange={handleToggle} />)

    const toggle = screen.getByRole('switch', { name: /enable alerts/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    // Click
    fireEvent.click(toggle)
    expect(handleToggle).toHaveBeenCalledWith(true)

    // Keyboard Space
    fireEvent.keyDown(toggle, { key: ' ' })
    expect(handleToggle).toHaveBeenCalled()

    // Keyboard Enter
    fireEvent.keyDown(toggle, { key: 'Enter' })
    expect(handleToggle).toHaveBeenCalled()
  })

  it('renders FormField with label, required asterisk, description and error', () => {
    render(
      <FormField
        id="email-field"
        label="Email Address"
        required
        description="We will never share your email"
        error="Invalid email format"
      >
        <input id="email-field" type="email" />
      </FormField>
    )

    expect(screen.getByText('Email Address')).toBeInTheDocument()
    expect(screen.getByText('*')).toBeInTheDocument()
    expect(screen.getByText('We will never share your email')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email format')
  })
})

describe('Loading Primitives (Skeleton & Spinner)', () => {
  it('renders Skeleton with pulse animation', () => {
    const { container } = render(<Skeleton className="h-6 w-24" />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('renders Spinner with accessible role and screen reader label', () => {
    render(<Spinner size="lg" label="Processing data..." />)
    const spinner = screen.getByRole('status')
    expect(spinner).toBeInTheDocument()
    expect(screen.getByText('Processing data...')).toHaveClass('sr-only')
  })
})

describe('Dialog & ConfirmDialog', () => {
  it('renders Dialog when open and responds to Escape key', () => {
    const handleClose = vi.fn()
    const { rerender } = render(
      <Dialog open={false} onClose={handleClose}>
        <p>Dialog Content</p>
      </Dialog>
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(
      <Dialog open={true} onClose={handleClose}>
        <p>Dialog Content</p>
      </Dialog>
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalled()
  })

  it('renders ConfirmDialog and triggers confirm and cancel buttons', () => {
    const handleConfirm = vi.fn()
    const handleCancel = vi.fn()

    render(
      <ConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure you want to delete this?"
        confirmLabel="Yes, Delete"
        isDestructive
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    )

    expect(screen.getByText('Delete Item')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to delete this?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(handleCancel).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }))
    expect(handleConfirm).toHaveBeenCalled()
  })
})

describe('Toast Notifications', () => {
  function TestToastConsumer() {
    const { showToast } = useToast()
    return (
      <button
        onClick={() =>
          showToast({
            title: 'Saved Successfully',
            description: 'Your changes have been stored.',
            type: 'success',
            durationMs: 5000,
          })
        }
      >
        Trigger Toast
      </button>
    )
  }

  it('displays toast message upon invocation and supports dismiss', () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /trigger toast/i }))
    expect(screen.getByText('Saved Successfully')).toBeInTheDocument()
    expect(screen.getByText('Your changes have been stored.')).toBeInTheDocument()

    const dismissBtn = screen.getByRole('button', { name: /dismiss notification/i })
    fireEvent.click(dismissBtn)
    expect(screen.queryByText('Saved Successfully')).not.toBeInTheDocument()
  })
})

describe('SearchInput', () => {
  it('handles debounced search input and clear button', async () => {
    const handleSearch = vi.fn()
    const handleClear = vi.fn()

    render(
      <SearchInput
        placeholder="Search projects..."
        onSearch={handleSearch}
        onClear={handleClear}
        debounceMs={50}
      />
    )

    const input = screen.getByPlaceholderText(/search projects.../i)
    fireEvent.change(input, { target: { value: 'hackathon' } })

    await waitFor(() => {
      expect(handleSearch).toHaveBeenCalledWith('hackathon')
    })

    const clearButton = screen.getByRole('button', { name: /clear search/i })
    fireEvent.click(clearButton)
    expect(handleClear).toHaveBeenCalled()
    expect(input).toHaveValue('')
  })
})

describe('Pagination', () => {
  it('renders pagination and handles page navigation', () => {
    const handlePageChange = vi.fn()
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={handlePageChange}
      />
    )

    const prevButton = screen.getByRole('button', { name: /previous/i })
    const nextButton = screen.getByRole('button', { name: /next/i })
    const page3Button = screen.getByRole('button', { name: /page 3/i })

    expect(prevButton).toBeEnabled()
    expect(nextButton).toBeEnabled()

    fireEvent.click(page3Button)
    expect(handlePageChange).toHaveBeenCalledWith(3)

    fireEvent.click(prevButton)
    expect(handlePageChange).toHaveBeenCalledWith(1)
  })
})

describe('Sortable & Filterable DataTable', () => {
  interface UserRecord {
    id: string
    name: string
    role: string
    score: number
  }

  const sampleUsers: UserRecord[] = [
    { id: '1', name: 'Alice', role: 'Engineer', score: 95 },
    { id: '2', name: 'Bob', role: 'Designer', score: 80 },
    { id: '3', name: 'Charlie', role: 'PM', score: 88 },
  ]

  const columns = [
    {
      key: 'name',
      header: 'Name',
      accessor: (u: UserRecord) => u.name,
      sortValue: (u: UserRecord) => u.name,
      sortable: true,
    },
    {
      key: 'role',
      header: 'Role',
      accessor: (u: UserRecord) => u.role,
    },
    {
      key: 'score',
      header: 'Score',
      accessor: (u: UserRecord) => u.score,
      sortValue: (u: UserRecord) => u.score,
      sortable: true,
    },
  ]

  it('renders table rows and sorts columns ascending and descending', () => {
    render(
      <DataTable
        data={sampleUsers}
        columns={columns}
        keyExtractor={(u) => u.id}
      />
    )

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()

    // Click score to sort ascending
    const scoreHeader = screen.getByRole('button', { name: /score/i })
    fireEvent.click(scoreHeader)

    const cellsAfterAsc = screen.getAllByRole('cell')
    // 80 should be first score
    expect(cellsAfterAsc.some((c) => c.textContent === '80')).toBe(true)

    // Click score again to sort descending
    fireEvent.click(scoreHeader)
    expect(scoreHeader.closest('th')).toHaveAttribute('aria-sort', 'descending')
  })

  it('filters table data and shows empty state when no records match', () => {
    const { rerender } = render(
      <DataTable
        data={sampleUsers}
        columns={columns}
        keyExtractor={(u) => u.id}
        filterText="Alice"
      />
    )

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()

    rerender(
      <DataTable
        data={sampleUsers}
        columns={columns}
        keyExtractor={(u) => u.id}
        filterText="NonExistentName"
      />
    )

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('shows loading and error states in DataTable', () => {
    const { rerender } = render(
      <DataTable
        data={sampleUsers}
        columns={columns}
        keyExtractor={(u) => u.id}
        isLoading
      />
    )

    expect(screen.getByTestId('loading-state')).toBeInTheDocument()

    rerender(
      <DataTable
        data={sampleUsers}
        columns={columns}
        keyExtractor={(u) => u.id}
        error="Network timeout"
      />
    )

    expect(screen.getByTestId('error-state')).toBeInTheDocument()
    expect(screen.getByText('Network timeout')).toBeInTheDocument()
  })
})

describe('FileUpload with Validation', () => {
  it('validates file size limit and displays error message', () => {
    const handleSelect = vi.fn()
    render(
      <FileUpload
        maxSizeBytes={1024} // 1KB limit
        onFileSelect={handleSelect}
      />
    )

    const dropzone = screen.getByRole('button', { name: /upload a file/i })
    const file = new File(['a'.repeat(2048)], 'large-file.pdf', { type: 'application/pdf' })

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/file size exceeds the limit/i)
    expect(handleSelect).toHaveBeenCalledWith(null)
  })

  it('validates file extension restrictions', () => {
    const handleSelect = vi.fn()
    render(
      <FileUpload
        allowedExtensions={['.png', '.jpg']}
        onFileSelect={handleSelect}
      />
    )

    const dropzone = screen.getByRole('button', { name: /upload a file/i })
    const file = new File(['data'], 'script.exe', { type: 'application/x-msdownload' })

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/file type not supported/i)
    expect(handleSelect).toHaveBeenCalledWith(null)
  })

  it('accepts valid file and displays file card with clear button', () => {
    const handleSelect = vi.fn()
    render(
      <FileUpload
        allowedExtensions={['.png', '.jpg']}
        onFileSelect={handleSelect}
      />
    )

    const dropzone = screen.getByRole('button', { name: /upload a file/i })
    const file = new File(['image-data'], 'photo.png', { type: 'image/png' })

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    })

    expect(screen.getByText('photo.png')).toBeInTheDocument()
    expect(handleSelect).toHaveBeenCalledWith(file)

    const removeButton = screen.getByRole('button', { name: /remove selected file/i })
    fireEvent.click(removeButton)
    expect(handleSelect).toHaveBeenCalledWith(null)
  })
})
