import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Annotation } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AnnotationService {
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  getAnnotations(roomId: string): Observable<Annotation[]> {
    return this.http.get<Annotation[]>(`${this.API_URL}/annotations/${roomId}`);
  }

  createAnnotation(roomId: string, annotation: Partial<Annotation>): Observable<Annotation> {
    return this.http.post<Annotation>(`${this.API_URL}/annotations/${roomId}`, annotation);
  }

  updateAnnotation(annotationId: string, annotation: Partial<Annotation>): Observable<Annotation> {
    return this.http.put<Annotation>(`${this.API_URL}/annotations/${annotationId}`, annotation);
  }

  deleteAnnotation(annotationId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/annotations/${annotationId}`);
  }

  // Helper methods for annotation calculations
  calculatePolygonArea(coordinates: Array<{ x: number; y: number; z: number }>): number {
    if (coordinates.length < 3) return 0;

    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coordinates[i].x * coordinates[j].z;
      area -= coordinates[j].x * coordinates[i].z;
    }
    
    return Math.abs(area) / 2;
  }

  calculateLineLength(coordinates: Array<{ x: number; y: number; z: number }>): number {
    if (coordinates.length < 2) return 0;

    let length = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const dx = coordinates[i + 1].x - coordinates[i].x;
      const dy = coordinates[i + 1].y - coordinates[i].y;
      const dz = coordinates[i + 1].z - coordinates[i].z;
      length += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    return length;
  }

  isPointInPolygon(point: { x: number; y: number; z: number }, 
                   polygon: Array<{ x: number; y: number; z: number }>): boolean {
    let inside = false;
    const n = polygon.length;
    
    for (let i = 0, j = n - 1; i < n; j = i++) {
      if (((polygon[i].z > point.z) !== (polygon[j].z > point.z)) &&
          (point.x < (polygon[j].x - polygon[i].x) * (point.z - polygon[i].z) / (polygon[j].z - polygon[i].z) + polygon[i].x)) {
        inside = !inside;
      }
    }
    
    return inside;
  }
}

