import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  AuthProvider,
  useAuth,
  useAbility,
  Can,
  ProtectedRoute,
} from '@/lib/auth'

function TestAuthConsumer() {
  const { user, isAuthenticated, login, logout } = useAuth()
  const { can } = useAbility()

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'logged-in' : 'logged-out'}</div>
      <div data-testid="user-email">{user?.email || 'none'}</div>
      <div data-testid="user-role">{user?.role || 'none'}</div>
      <div data-testid="can-delete-project">
        {can('delete', 'Project') ? 'can-delete' : 'cannot-delete'}
      </div>
      <button
        onClick={() =>
          login({ email: 'admin@example.com', password: 'Password123' })
        }
      >
        Login Admin
      </button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  )
}

describe('Authentication & Authorization Toolkit — Component Tests', () => {
  it('provides authentication state and handles login/logout through AuthProvider', async () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('auth-status').textContent).toBe('logged-out')
    expect(screen.getByTestId('user-email').textContent).toBe('none')

    // Click Login
    fireEvent.click(screen.getByText('Login Admin'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('logged-in')
      expect(screen.getByTestId('user-email').textContent).toBe('admin@example.com')
      expect(screen.getByTestId('user-role').textContent).toBe('admin')
      expect(screen.getByTestId('can-delete-project').textContent).toBe('can-delete')
    })

    // Click Logout
    fireEvent.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('logged-out')
      expect(screen.getByTestId('user-email').textContent).toBe('none')
    })
  })

  it('renders UI conditionally using <Can /> based on permissions', () => {
    const editorUser = {
      id: 'usr_editor_1',
      email: 'editor@test.com',
      role: 'editor',
    }

    render(
      <AuthProvider initialUser={editorUser}>
        <Can I="update" an="Project">
          <button data-testid="edit-btn">Edit Project</button>
        </Can>
        <Can
          I="delete"
          an="Project"
          fallback={<span data-testid="delete-blocked">No permission to delete</span>}
        >
          <button data-testid="delete-btn">Delete Project</button>
        </Can>
      </AuthProvider>
    )

    // Editor can update
    expect(screen.getByTestId('edit-btn')).toBeInTheDocument()

    // Editor cannot delete -> renders fallback
    expect(screen.queryByTestId('delete-btn')).not.toBeInTheDocument()
    expect(screen.getByTestId('delete-blocked')).toBeInTheDocument()
  })

  it('protects routes using <ProtectedRoute /> with role-based fallbacks', () => {
    const regularUser = {
      id: 'usr_reg_1',
      email: 'user@test.com',
      role: 'user',
    }

    render(
      <AuthProvider initialUser={regularUser}>
        <ProtectedRoute
          roles={['admin']}
          fallback={<div data-testid="forbidden-view">403 Access Denied</div>}
        >
          <div data-testid="admin-panel">Secret Admin Settings</div>
        </ProtectedRoute>
      </AuthProvider>
    )

    // Regular user cannot see admin panel
    expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('forbidden-view')).toBeInTheDocument()
  })

  it('allows access in <ProtectedRoute /> when user has permitted role', () => {
    const adminUser = {
      id: 'usr_adm_1',
      email: 'admin@test.com',
      role: 'admin',
    }

    render(
      <AuthProvider initialUser={adminUser}>
        <ProtectedRoute
          roles={['admin']}
          fallback={<div data-testid="forbidden-view">403 Access Denied</div>}
        >
          <div data-testid="admin-panel">Secret Admin Settings</div>
        </ProtectedRoute>
      </AuthProvider>
    )

    expect(screen.getByTestId('admin-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('forbidden-view')).not.toBeInTheDocument()
  })
})
