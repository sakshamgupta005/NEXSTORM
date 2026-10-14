import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InteractiveMap } from '@/components/geo/interactive-map';
import { LocationPicker } from '@/components/geo/location-picker';
import { MapMarker } from '@/lib/geo/types';

describe('InteractiveMap Component', () => {
  const sampleMarkers: MapMarker[] = [
    {
      id: 'm1',
      position: { lat: 37.7749, lng: -122.4194 },
      title: 'San Francisco HQ',
      description: 'Main Innovation Campus',
      color: '#3b82f6',
    },
    {
      id: 'm2',
      position: { lat: 37.7833, lng: -122.4167 },
      title: 'Tenderloin Lab',
      description: 'Research Facility',
      color: '#10b981',
    },
  ];

  it('renders interactive map region with accessible controls and markers', () => {
    render(
      <InteractiveMap
        center={{ lat: 37.7749, lng: -122.4194 }}
        zoom={12}
        markers={sampleMarkers}
      />
    );

    const map = screen.getByRole('region', { name: /interactive map view/i });
    expect(map).toBeInTheDocument();
    expect(screen.getByTestId('zoom-in-button')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-out-button')).toBeInTheDocument();
    expect(screen.getByTestId('reset-view-button')).toBeInTheDocument();

    // Check marker pins
    expect(screen.getByTestId('map-marker-m1')).toBeInTheDocument();
    expect(screen.getByTestId('map-marker-m2')).toBeInTheDocument();
  });

  it('opens marker popup card upon clicking a marker', () => {
    const onMarkerClick = vi.fn();
    render(
      <InteractiveMap
        center={{ lat: 37.7749, lng: -122.4194 }}
        markers={sampleMarkers}
        onMarkerClick={onMarkerClick}
      />
    );

    const markerPin = screen.getByTestId('map-marker-m1');
    fireEvent.click(markerPin);

    expect(onMarkerClick).toHaveBeenCalledWith(sampleMarkers[0]);
    expect(screen.getByRole('dialog', { name: /san francisco hq/i })).toBeInTheDocument();
    expect(screen.getByText('Main Innovation Campus')).toBeInTheDocument();

    // Close popup
    const closeBtn = screen.getByRole('button', { name: /close popup/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('increments and decrements zoom level on button interactions', () => {
    render(<InteractiveMap center={{ lat: 37.7749, lng: -122.4194 }} zoom={10} />);

    expect(screen.getByText(/zoom: 10x/i)).toBeInTheDocument();

    const zoomIn = screen.getByTestId('zoom-in-button');
    fireEvent.click(zoomIn);
    expect(screen.getByText(/zoom: 11x/i)).toBeInTheDocument();

    const zoomOut = screen.getByTestId('zoom-out-button');
    fireEvent.click(zoomOut);
    expect(screen.getByText(/zoom: 10x/i)).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<InteractiveMap isLoading={true} />);
    expect(screen.getByText(/initializing map view/i)).toBeInTheDocument();
    expect(screen.queryByTestId('interactive-map')).not.toBeInTheDocument();
  });

  it('renders alert error container when error prop is supplied', () => {
    render(<InteractiveMap error="Tile service unavailable" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/failed to load map/i);
    expect(alert).toHaveTextContent('Tile service unavailable');
  });
});

describe('LocationPicker Component', () => {
  it('renders location picker controls with search input and geolocation button', () => {
    render(<LocationPicker label="Select Delivery Destination" />);

    expect(screen.getByText('Select Delivery Destination')).toBeInTheDocument();
    expect(screen.getByTestId('use-my-location-button')).toBeInTheDocument();
    expect(screen.getByTestId('location-search-input')).toBeInTheDocument();
  });

  it('searches address and updates coordinates on submit', async () => {
    const onLocationSelect = vi.fn();
    render(<LocationPicker onLocationSelect={onLocationSelect} />);

    const searchInput = screen.getByTestId('location-search-input');
    fireEvent.change(searchInput, { target: { value: 'London' } });

    const submitBtn = screen.getByRole('button', { name: /^search$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onLocationSelect).toHaveBeenCalled();
    });

    const callArgs = onLocationSelect.mock.calls[0];
    expect(callArgs[0].lat).toBeCloseTo(51.5074, 1);
    expect(callArgs[0].lng).toBeCloseTo(-0.1278, 1);
  });
});
