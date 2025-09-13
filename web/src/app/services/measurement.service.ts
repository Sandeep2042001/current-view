import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Measurement } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class MeasurementService {
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  getMeasurements(roomId: string): Observable<Measurement[]> {
    return this.http.get<Measurement[]>(`${this.API_URL}/measurements/${roomId}`);
  }

  createMeasurement(roomId: string, measurement: Partial<Measurement>): Observable<Measurement> {
    return this.http.post<Measurement>(`${this.API_URL}/measurements/${roomId}`, measurement);
  }

  updateMeasurement(roomId: string, measurementId: string, measurement: Partial<Measurement>): Observable<Measurement> {
    return this.http.put<Measurement>(`${this.API_URL}/measurements/${roomId}/${measurementId}`, measurement);
  }

  deleteMeasurement(roomId: string, measurementId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/measurements/${roomId}/${measurementId}`);
  }

  getMeasurementStats(roomId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/measurements/${roomId}/stats`);
  }

  calculateDistance(point1: { x: number; y: number; z: number }, point2: { x: number; y: number; z: number }): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const dz = point2.z - point1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  calculateAngle(point1: { x: number; y: number; z: number }, 
                 point2: { x: number; y: number; z: number }, 
                 point3: { x: number; y: number; z: number }): number {
    // Calculate angle at point2
    const v1 = {
      x: point1.x - point2.x,
      y: point1.y - point2.y,
      z: point1.z - point2.z
    };
    
    const v2 = {
      x: point3.x - point2.x,
      y: point3.y - point2.y,
      z: point3.z - point2.z
    };

    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
    
    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    
    return (angle * 180) / Math.PI; // Convert to degrees
  }

  convertUnits(value: number, fromUnit: string, toUnit: string): number {
    const conversions: { [key: string]: { [key: string]: number } } = {
      'meters': {
        'feet': 3.28084,
        'inches': 39.3701,
        'centimeters': 100,
        'millimeters': 1000
      },
      'feet': {
        'meters': 0.3048,
        'inches': 12,
        'centimeters': 30.48,
        'millimeters': 304.8
      },
      'inches': {
        'meters': 0.0254,
        'feet': 0.0833333,
        'centimeters': 2.54,
        'millimeters': 25.4
      }
    };

    if (fromUnit === toUnit) return value;
    if (!conversions[fromUnit] || !conversions[fromUnit][toUnit]) return value;
    
    return value * conversions[fromUnit][toUnit];
  }
}

