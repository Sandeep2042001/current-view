import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeasurementService, MeasurementPoint } from '../../services/measurement.service';
import { Measurement } from '../../models/user.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-measurement-tool',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="measurement-tool">
      <!-- Toggle Button -->
      <button 
        class="measurement-toggle"
        [class.active]="isMeasurementMode"
        (click)="toggleMeasurementMode()"
        title="Measurement Tool">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 3l18 18M3 3v18M21 3v18M3 21h18" stroke-width="2"/>
          <circle cx="3" cy="3" r="2" fill="currentColor"/>
          <circle cx="21" cy="21" r="2" fill="currentColor"/>
        </svg>
        Measure
      </button>

      <!-- Measurement Mode Indicator -->
      <div class="measurement-status" *ngIf="isMeasurementMode">
        <div class="status-header">
          <span class="status-icon">📏</span>
          <span class="status-text">Measurement Mode</span>
          <button class="close-btn" (click)="toggleMeasurementMode()">×</button>
        </div>
        <div class="status-instructions">
          {{ currentPoints.length === 0 ? 'Click point A' : 'Click point B' }}
        </div>
        
        <!-- Current Points -->
        <div class="current-points" *ngIf="currentPoints.length > 0">
          <div class="point" *ngFor="let point of currentPoints; let i = index">
            <span class="point-label">{{ i === 0 ? 'A' : 'B' }}</span>
            <span class="point-coords">({{ point.x | number:'1.0-0' }}, {{ point.y | number:'1.0-0' }})</span>
          </div>
        </div>
      </div>

      <!-- Measurements List -->
      <div class="measurements-panel" *ngIf="measurements.length > 0">
        <div class="panel-header">
          <h3>Measurements</h3>
          <button class="clear-btn" (click)="clearAll()" title="Clear all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-width="2"/>
            </svg>
          </button>
        </div>
        
        <div class="measurements-list">
          <div class="measurement-item" *ngFor="let measurement of measurements; let i = index">
            <div class="measurement-header">
              <span class="measurement-number">#{{ i + 1 }}</span>
              <span class="measurement-points">A → B</span>
              <button class="delete-btn" (click)="deleteMeasurement(measurement.id)" title="Delete">×</button>
            </div>
            <div class="measurement-distance">
              <span class="distance-value">{{ formatDistance(measurement) }}</span>
            </div>
            <div class="measurement-details">
              <small>
                {{ (measurement.metadata?.distanceFeet || 0) | number:'1.0-1' }}' 
                ({{ (measurement.metadata?.distanceMeters || 0) | number:'1.2-2' }}m)
              </small>
            </div>
          </div>
        </div>

        <!-- Calibration Section -->
        <div class="calibration-section">
          <button class="calibration-btn" (click)="showCalibration = !showCalibration">
            🎯 Calibrate Scale
          </button>
          
          <div class="calibration-form" *ngIf="showCalibration">
            <p class="calibration-help">
              Measure a known distance (e.g., door width) then enter the real-world measurement:
            </p>
            <div class="form-group">
              <label>Last measured distance (pixels):</label>
              <input type="number" [(ngModel)]="lastPixelDistance" readonly>
            </div>
            <div class="form-group">
              <label>Real-world distance:</label>
              <div class="input-with-unit">
                <input type="number" [(ngModel)]="calibrationValue" step="0.1">
                <select [(ngModel)]="calibrationUnit">
                  <option value="meters">meters</option>
                  <option value="feet">feet</option>
                  <option value="inches">inches</option>
                </select>
              </div>
            </div>
            <button class="apply-btn" (click)="applyCalibration()">Apply Calibration</button>
          </div>
        </div>

        <!-- Export Button -->
        <button class="export-btn" (click)="exportMeasurements()">
          📊 Export Measurements
        </button>
      </div>
    </div>
  `,
  styles: [`
    .measurement-tool {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .measurement-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .measurement-toggle:hover {
      border-color: #2196F3;
      color: #2196F3;
    }

    .measurement-toggle.active {
      background: #2196F3;
      color: white;
      border-color: #2196F3;
    }

    .measurement-status {
      background: white;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      min-width: 250px;
    }

    .status-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .status-icon {
      font-size: 20px;
    }

    .status-text {
      flex: 1;
      font-weight: 600;
      color: #333;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .close-btn:hover {
      color: #333;
    }

    .status-instructions {
      color: #2196F3;
      font-size: 14px;
      font-weight: 500;
      padding: 8px;
      background: #E3F2FD;
      border-radius: 4px;
      text-align: center;
    }

    .current-points {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .point {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 13px;
    }

    .point-label {
      font-weight: 600;
      color: #2196F3;
      min-width: 20px;
    }

    .point-coords {
      color: #666;
      font-family: monospace;
    }

    .measurements-panel {
      background: white;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      min-width: 300px;
      max-width: 350px;
      max-height: 500px;
      display: flex;
      flex-direction: column;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e0e0e0;
    }

    .panel-header h3 {
      margin: 0;
      font-size: 16px;
      color: #333;
    }

    .clear-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #999;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .clear-btn:hover {
      color: #f44336;
    }

    .measurements-list {
      flex: 1;
      overflow-y: auto;
      margin-bottom: 12px;
    }

    .measurement-item {
      background: #f9f9f9;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 8px;
      border-left: 3px solid #2196F3;
    }

    .measurement-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .measurement-number {
      font-weight: 600;
      color: #2196F3;
      font-size: 12px;
    }

    .measurement-points {
      flex: 1;
      font-size: 13px;
      color: #666;
      font-family: monospace;
    }

    .delete-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #999;
      font-size: 20px;
      padding: 0;
      width: 20px;
      height: 20px;
    }

    .delete-btn:hover {
      color: #f44336;
    }

    .measurement-distance {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }

    .measurement-details {
      font-size: 12px;
      color: #999;
    }

    .calibration-section {
      border-top: 1px solid #e0e0e0;
      padding-top: 12px;
      margin-bottom: 8px;
    }

    .calibration-btn {
      width: 100%;
      padding: 8px;
      background: #FFF3E0;
      border: 1px solid #FFB74D;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: #E65100;
    }

    .calibration-btn:hover {
      background: #FFE0B2;
    }

    .calibration-form {
      margin-top: 12px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 4px;
    }

    .calibration-help {
      font-size: 12px;
      color: #666;
      margin-bottom: 12px;
    }

    .form-group {
      margin-bottom: 12px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #333;
      margin-bottom: 4px;
    }

    .form-group input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
    }

    .input-with-unit {
      display: flex;
      gap: 8px;
    }

    .input-with-unit input {
      flex: 1;
    }

    .input-with-unit select {
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
    }

    .apply-btn {
      width: 100%;
      padding: 8px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }

    .apply-btn:hover {
      background: #45a049;
    }

    .export-btn {
      width: 100%;
      padding: 8px;
      background: #2196F3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }

    .export-btn:hover {
      background: #1976D2;
    }
  `]
})
export class MeasurementToolComponent implements OnInit, OnDestroy {
  isMeasurementMode = false;
  measurements: Measurement[] = [];
  currentPoints: MeasurementPoint[] = [];
  showCalibration = false;
  calibrationValue = 0.9; // Default: door width in meters
  calibrationUnit = 'meters';
  lastPixelDistance = 0;

  private subscriptions: Subscription[] = [];

  constructor(public measurementService: MeasurementService) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.measurementService.measurementMode$.subscribe(mode => {
        this.isMeasurementMode = mode;
      }),
      this.measurementService.measurements$.subscribe(measurements => {
        this.measurements = measurements;
        if (measurements.length > 0) {
          const lastMeasurement = measurements[measurements.length - 1];
          if (lastMeasurement.points && lastMeasurement.points.length >= 2) {
            this.lastPixelDistance = this.calculatePixelDistance(
              lastMeasurement.points[0],
              lastMeasurement.points[1]
            );
          }
        }
      }),
      this.measurementService.currentPoints$.subscribe(points => {
        this.currentPoints = points;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  toggleMeasurementMode(): void {
    this.measurementService.toggleMeasurementMode();
  }

  clearAll(): void {
    if (confirm('Clear all measurements?')) {
      this.measurementService.clearMeasurements();
    }
  }

  deleteMeasurement(id: string): void {
    this.measurementService.deleteMeasurement(id);
  }

  formatDistance(measurement: Measurement): string {
    return this.measurementService.formatDistance(measurement);
  }

  calculatePixelDistance(pointA: any, pointB: any): number {
    const dx = pointB.x - pointA.x;
    const dy = pointB.y - pointA.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  applyCalibration(): void {
    if (this.lastPixelDistance === 0) {
      alert('Please make a measurement first');
      return;
    }

    let realWorldMeters = this.calibrationValue;
    
    // Convert to meters
    if (this.calibrationUnit === 'feet') {
      realWorldMeters = this.calibrationValue * 0.3048;
    } else if (this.calibrationUnit === 'inches') {
      realWorldMeters = this.calibrationValue * 0.0254;
    }

    // Get current room ID (you may need to pass this from parent)
    const roomId = 'current-room'; // TODO: Get from current room context
    
    this.measurementService.calibrateScale(roomId, this.lastPixelDistance, realWorldMeters);
    
    alert('Calibration applied! All measurements will now use this scale.');
    this.showCalibration = false;
  }

  exportMeasurements(): void {
    const json = this.measurementService.exportMeasurements();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `measurements-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

