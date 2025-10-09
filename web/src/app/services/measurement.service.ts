import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Measurement } from '../models/user.model';

export interface MeasurementPoint {
  x: number;
  y: number;
  z?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MeasurementService {
  private measurementModeSubject = new BehaviorSubject<boolean>(false);
  private measurementsSubject = new BehaviorSubject<Measurement[]>([]);
  private currentPointsSubject = new BehaviorSubject<MeasurementPoint[]>([]);
  
  // Scale factor: pixels per meter (calibrated per room)
  private scaleFactors = new Map<string, number>();
  
  measurementMode$: Observable<boolean> = this.measurementModeSubject.asObservable();
  measurements$: Observable<Measurement[]> = this.measurementsSubject.asObservable();
  currentPoints$: Observable<MeasurementPoint[]> = this.currentPointsSubject.asObservable();

  // Helper to calculate distance in inches from pixels
  private calculateDistanceInInches(pixelDistance: number, roomId: string): number {
    const scaleFactor = this.scaleFactors.get(roomId) || this.getDefaultScaleFactor();
    const distanceMeters = pixelDistance / scaleFactor;
    return distanceMeters * 39.3701; // Convert meters to inches
  }

  constructor() {}

  /**
   * Toggle measurement mode on/off
   */
  toggleMeasurementMode(): void {
    const newMode = !this.measurementModeSubject.value;
    this.measurementModeSubject.next(newMode);
    
    if (!newMode) {
      // Clear current points when exiting measurement mode
      this.currentPointsSubject.next([]);
    }
  }

  /**
   * Set measurement mode
   */
  setMeasurementMode(enabled: boolean): void {
    this.measurementModeSubject.next(enabled);
    if (!enabled) {
      this.currentPointsSubject.next([]);
    }
  }

  /**
   * Check if measurement mode is active
   */
  isMeasurementMode(): boolean {
    return this.measurementModeSubject.value;
  }

  /**
   * Add a measurement point
   */
  addPoint(x: number, y: number, roomId: string, z?: number): void {
    const currentPoints = this.currentPointsSubject.value;
    
    const point: MeasurementPoint = {
      x,
      y,
      z
    };

    const updatedPoints = [...currentPoints, point];
    this.currentPointsSubject.next(updatedPoints);

    // If we have 2 points, create a measurement
    if (updatedPoints.length === 2) {
      this.createMeasurement(roomId, {
        type: 'point_to_point',
        points: updatedPoints
      });
      // Reset points for next measurement
      setTimeout(() => {
        this.currentPointsSubject.next([]);
      }, 100);
    }
  }

  /**
   * Set scale factor for a room (pixels per meter)
   * This should be calibrated using a known reference measurement
   */
  setScaleFactor(roomId: string, pixelsPerMeter: number): void {
    this.scaleFactors.set(roomId, pixelsPerMeter);
  }

  /**
   * Calibrate scale using a reference measurement
   * User measures a known distance (e.g., door width = 0.9m)
   */
  calibrateScale(roomId: string, pixelDistance: number, realWorldMeters: number): void {
    const scaleFactor = pixelDistance / realWorldMeters;
    this.setScaleFactor(roomId, scaleFactor);
  }

  /**
   * Get default scale factor
   * Assumes average room is about 4 meters wide and image is 2048 pixels
   */
  private getDefaultScaleFactor(): number {
    return 512; // pixels per meter (2048px / 4m)
  }

  /**
   * Clear all measurements
   */
  clearMeasurements(): void {
    this.measurementsSubject.next([]);
    this.currentPointsSubject.next([]);
  }

  /**
   * Delete a specific measurement
   */
  deleteMeasurement(id: string): void {
    const currentMeasurements = this.measurementsSubject.value;
    const updated = currentMeasurements.filter(m => m.id !== id);
    this.measurementsSubject.next(updated);
  }

  /**
   * Get all measurements (returns array directly for compatibility)
   */
  getMeasurements(roomId?: string): Measurement[] {
    if (roomId) {
      return this.measurementsSubject.value.filter(m => m.room_id === roomId);
    }
    return this.measurementsSubject.value;
  }

  /**
   * Get measurements for a specific room
   */
  getRoomMeasurements(roomId: string): Measurement[] {
    return this.measurementsSubject.value.filter(m => m.room_id === roomId);
  }

  /**
   * Create measurement (public method for viewer compatibility)
   */
  createMeasurement(roomId: string, measurementData: any): Measurement {
    const points = measurementData.points || [];
    
    if (points.length !== 2) {
      throw new Error('Measurement requires exactly 2 points');
    }

    // Calculate pixel distance
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const dz = (points[1].z || 0) - (points[0].z || 0);
    const pixelDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Convert to real-world distance
    const scaleFactor = this.scaleFactors.get(roomId) || this.getDefaultScaleFactor();
    const distanceMeters = pixelDistance / scaleFactor;
    const distanceInches = distanceMeters * 39.3701;

    // Create measurement matching the expected interface
    const measurement: Measurement = {
      id: this.generateId(),
      room_id: roomId,
      type: measurementData.type || 'point_to_point',
      points: points,
      distance: distanceInches, // Store in inches as requested
      unit: 'inches',
      label: measurementData.label || `${distanceInches.toFixed(2)} inches`,
      metadata: {
        distanceMeters: distanceMeters,
        distanceFeet: distanceMeters * 3.28084,
        distanceInches: distanceInches,
        pixelDistance: pixelDistance,
        scaleFactor: scaleFactor
      },
      created_at: new Date().toISOString()
    };

    const currentMeasurements = this.measurementsSubject.value;
    this.measurementsSubject.next([...currentMeasurements, measurement]);

    return measurement;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format distance for display
   */
  formatDistance(measurement: Measurement): string {
    const distanceInches = measurement.distance || 0;
    const distanceMeters = measurement.metadata?.['distanceMeters'] || (distanceInches / 39.3701);
    const distanceFeet = measurement.metadata?.['distanceFeet'] || (distanceMeters * 3.28084);
    
    switch (measurement.unit) {
      case 'inches':
        return `${distanceInches.toFixed(2)} inches`;
      case 'feet':
        const feet = Math.floor(distanceFeet);
        const inches = ((distanceFeet - feet) * 12);
        return `${feet}' ${inches.toFixed(1)}"`;
      case 'meters':
        return `${distanceMeters.toFixed(3)} m`;
      default:
        return `${distanceInches.toFixed(2)} inches`;
    }
  }

  /**
   * Export measurements to JSON
   */
  exportMeasurements(roomId?: string): string {
    const measurements = roomId 
      ? this.getRoomMeasurements(roomId)
      : this.getMeasurements();
    
    return JSON.stringify(measurements, null, 2);
  }

  /**
   * Import measurements from JSON
   */
  importMeasurements(jsonString: string): void {
    try {
      const imported = JSON.parse(jsonString) as Measurement[];
      const current = this.measurementsSubject.value;
      this.measurementsSubject.next([...current, ...imported]);
    } catch (error) {
      console.error('Failed to import measurements:', error);
    }
  }
}
