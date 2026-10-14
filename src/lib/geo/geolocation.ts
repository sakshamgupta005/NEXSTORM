import { GeolocationResult, GeolocationError } from './types';

export interface GeolocationRequestOptions {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
}

/**
 * Checks if browser Geolocation API is supported in the current environment.
 */
export function isGeolocationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.geolocation)
  );
}

/**
 * Requests the user's current coordinates via browser Geolocation API.
 * 
 * PRIVACY GUARD: Must ONLY be called in response to an explicit user interaction (e.g. clicking "Locate Me").
 * Never invoke silently on page load.
 */
export function requestGeolocation(
  options?: GeolocationRequestOptions
): Promise<{ success: true; data: GeolocationResult } | { success: false; error: GeolocationError }> {
  if (!isGeolocationSupported()) {
    return Promise.resolve({
      success: false,
      error: {
        code: 'NOT_SUPPORTED',
        message: 'Browser geolocation is not supported in this environment.',
      },
    });
  }

  const timeout = options?.timeoutMs ?? 10_000;
  const maximumAge = options?.maximumAgeMs ?? 30_000;
  const enableHighAccuracy = options?.enableHighAccuracy ?? true;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          success: true,
          data: {
            coordinates: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            accuracyMeters: position.coords.accuracy,
            altitudeMeters: position.coords.altitude,
            headingDegrees: position.coords.heading,
            speedMps: position.coords.speed,
            timestamp: position.timestamp,
          },
        });
      },
      (err) => {
        let code: GeolocationError['code'] = 'POSITION_UNAVAILABLE';
        let message = 'Failed to acquire current location.';

        switch (err.code) {
          case 1: // PERMISSION_DENIED
            code = 'PERMISSION_DENIED';
            message = 'Location access was denied. Please allow location permissions in your browser.';
            break;
          case 2: // POSITION_UNAVAILABLE
            code = 'POSITION_UNAVAILABLE';
            message = 'Current location is unavailable or GPS fix could not be acquired.';
            break;
          case 3: // TIMEOUT
            code = 'TIMEOUT';
            message = `Geolocation request timed out after ${timeout / 1000} seconds.`;
            break;
        }

        resolve({
          success: false,
          error: { code, message },
        });
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  });
}

/**
 * Subscribes to live location updates with cleanup unmount handler.
 */
export function watchGeolocation(
  onSuccess: (result: GeolocationResult) => void,
  onError: (error: GeolocationError) => void,
  options?: GeolocationRequestOptions
): () => void {
  if (!isGeolocationSupported()) {
    onError({
      code: 'NOT_SUPPORTED',
      message: 'Browser geolocation is not supported in this environment.',
    });
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        coordinates: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        accuracyMeters: position.coords.accuracy,
        altitudeMeters: position.coords.altitude,
        headingDegrees: position.coords.heading,
        speedMps: position.coords.speed,
        timestamp: position.timestamp,
      });
    },
    (err) => {
      let code: GeolocationError['code'] = 'POSITION_UNAVAILABLE';
      let message = 'Failed to acquire location update.';
      if (err.code === 1) {
        code = 'PERMISSION_DENIED';
        message = 'Location access was denied.';
      } else if (err.code === 3) {
        code = 'TIMEOUT';
        message = 'Location watch request timed out.';
      }
      onError({ code, message });
    },
    {
      enableHighAccuracy: options?.enableHighAccuracy ?? true,
      timeout: options?.timeoutMs ?? 15_000,
      maximumAge: options?.maximumAgeMs ?? 5_000,
    }
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}
