import { Component, OnInit, OnDestroy, ElementRef, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeasurementService } from '../../services/measurement.service';
import { ToastrService } from 'ngx-toastr';
import { Measurement } from '../../models/user.model';

@Component({
  selector: 'app-measurement-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="measurement-tools" [class.active]="isActive">
      <!-- Tool Selection -->
      <div class="tool-selection">
        <h3>Measurement Tools</h3>
        <div class="tool-buttons">
          <button 
            (click)="selectTool('point_to_point')" 
            [class.active]="selectedTool === 'point_to_point'"
            class="tool-btn">
            <i class="material-icons">straighten</i>
            Point to Point
          </button>
          <button 
            (click)="selectTool('corner')" 
            [class.active]="selectedTool === 'corner'"
            class="tool-btn">
            <i class="material-icons">crop_square</i>
            Corner
          </button>
          <button 
            (click)="selectTool('edge')" 
            [class.active]="selectedTool === 'edge'"
            class="tool-btn">
            <i class="material-icons">timeline</i>
            Edge
          </button>
        </div>
      </div>

      <!-- Measurement Settings -->
      <div class="measurement-settings" *ngIf="selectedTool">
        <div class="setting-group">
          <label>Unit:</label>
          <select [(ngModel)]="selectedUnit" class="unit-selector">
            <option value="meters">Meters</option>
            <option value="feet">Feet</option>
            <option value="inches">Inches</option>
            <option value="centimeters">Centimeters</option>
            <option value="millimeters">Millimeters</option>
          </select>
        </div>

        <div class="setting-group">
          <label>Precision:</label>
          <select [(ngModel)]="precision" class="precision-selector">
            <option value="1">1 decimal</option>
            <option value="2">2 decimals</option>
            <option value="3">3 decimals</option>
          </select>
        </div>

        <div class="setting-group">
          <label>
            <input type="checkbox" [(ngModel)]="showLabels">
            Show Labels
          </label>
        </div>
      </div>

      <!-- Active Measurement -->
      <div class="active-measurement" *ngIf="currentMeasurement">
        <h4>Current Measurement</h4>
        <div class="measurement-info">
          <div class="measurement-points">
            <div *ngFor="let point of currentMeasurement.points; let i = index" 
                 class="point-info">
              <span class="point-label">Point {{ i + 1 }}:</span>
              <span class="point-coords">
                ({{ point.x | number:'1.2-2' }}, {{ point.y | number:'1.2-2' }}, {{ point.z | number:'1.2-2' }})
              </span>
            </div>
          </div>

          <div class="measurement-results" *ngIf="currentMeasurement.distance">
            <div class="result-item">
              <span class="result-label">Distance:</span>
              <span class="result-value">
                {{ currentMeasurement.distance | number:'1.' + precision + '-' + precision }} {{ selectedUnit }}
              </span>
            </div>
            <div class="result-item" *ngIf="currentMeasurement.type === 'corner' && angle">
              <span class="result-label">Angle:</span>
              <span class="result-value">{{ angle | number:'1.1-1' }}°</span>
            </div>
          </div>

          <div class="measurement-actions">
            <button (click)="addPoint()" 
                    [disabled]="!canAddPoint" 
                    class="action-btn primary">
              <i class="material-icons">add</i>
              Add Point
            </button>
            <button (click)="finishMeasurement()" 
                    [disabled]="!canFinish" 
                    class="action-btn success">
              <i class="material-icons">check</i>
              Finish
            </button>
            <button (click)="cancelMeasurement()" class="action-btn danger">
              <i class="material-icons">close</i>
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Measurements List -->
      <div class="measurements-list" *ngIf="measurements.length > 0">
        <h4>Saved Measurements ({{ measurements.length }})</h4>
        <div class="measurement-item" *ngFor="let measurement of measurements; let i = index">
          <div class="measurement-header">
            <span class="measurement-type">{{ measurement.type | titlecase }}</span>
            <span class="measurement-distance" *ngIf="measurement.distance">
              {{ measurement.distance | number:'1.2-2' }} {{ measurement.unit }}
            </span>
            <div class="measurement-actions">
              <button (click)="editMeasurement(measurement)" class="btn-icon">
                <i class="material-icons">edit</i>
              </button>
              <button (click)="deleteMeasurement(measurement)" class="btn-icon danger">
                <i class="material-icons">delete</i>
              </button>
            </div>
          </div>
          <div class="measurement-details" *ngIf="measurement.label">
            <span class="measurement-label">{{ measurement.label }}</span>
          </div>
        </div>
      </div>

      <!-- Instructions -->
      <div class="instructions" *ngIf="selectedTool && !currentMeasurement">
        <h4>Instructions</h4>
        <div class="instruction-content" [innerHTML]="getInstructions()"></div>
      </div>
    </div>
  `,
  styleUrls: ['./measurement-tools.component.scss']
})
export class MeasurementToolsComponent implements OnInit, OnDestroy {
  @Input() roomId!: string;
  @Input() isActive = false;
  @Output() measurementCreated = new EventEmitter<Measurement>();
  @Output() measurementUpdated = new EventEmitter<Measurement>();
  @Output() measurementDeleted = new EventEmitter<string>();

  selectedTool: 'point_to_point' | 'corner' | 'edge' | null = null;
  selectedUnit = 'meters';
  precision = 2;
  showLabels = true;

  measurements: Measurement[] = [];
  currentMeasurement: Partial<Measurement> | null = null;
  angle: number | null = null;

  constructor(
    private measurementService: MeasurementService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadMeasurements();
  }

  ngOnDestroy() {
    this.cancelMeasurement();
  }

  async loadMeasurements() {
    try {
      this.measurements = await this.measurementService.getMeasurements(this.roomId).toPromise();
    } catch (error) {
      console.error('Error loading measurements:', error);
    }
  }

  selectTool(tool: 'point_to_point' | 'corner' | 'edge') {
    this.selectedTool = tool;
    this.startNewMeasurement();
  }

  startNewMeasurement() {
    if (!this.selectedTool) return;

    this.currentMeasurement = {
      roomId: this.roomId,
      type: this.selectedTool,
      points: [],
      unit: this.selectedUnit,
      label: ''
    };
    this.angle = null;
  }

  addPoint() {
    if (!this.currentMeasurement) return;

    // In a real implementation, this would get the 3D coordinates from the viewer
    const point = this.getCurrentViewerPosition();
    this.currentMeasurement.points!.push(point);

    this.updateMeasurementCalculations();
  }

  private getCurrentViewerPosition(): { x: number; y: number; z: number } {
    // This would be connected to the 3D viewer to get the actual position
    // For now, return a mock position
    return {
      x: Math.random() * 10 - 5,
      y: Math.random() * 10 - 5,
      z: Math.random() * 10 - 5
    };
  }

  private updateMeasurementCalculations() {
    if (!this.currentMeasurement || !this.currentMeasurement.points) return;

    const points = this.currentMeasurement.points;
    
    if (points.length >= 2) {
      // Calculate distance
      const distance = this.measurementService.calculateDistance(points[0], points[points.length - 1]);
      this.currentMeasurement.distance = this.measurementService.convertUnits(
        distance, 'meters', this.selectedUnit
      );
    }

    if (this.currentMeasurement.type === 'corner' && points.length >= 3) {
      // Calculate angle
      this.angle = this.measurementService.calculateAngle(points[0], points[1], points[2]);
    }
  }

  get canAddPoint(): boolean {
    if (!this.currentMeasurement) return false;
    
    switch (this.currentMeasurement.type) {
      case 'point_to_point':
        return this.currentMeasurement.points!.length < 2;
      case 'corner':
        return this.currentMeasurement.points!.length < 3;
      case 'edge':
        return this.currentMeasurement.points!.length < 2;
      default:
        return false;
    }
  }

  get canFinish(): boolean {
    if (!this.currentMeasurement) return false;
    
    switch (this.currentMeasurement.type) {
      case 'point_to_point':
        return this.currentMeasurement.points!.length >= 2;
      case 'corner':
        return this.currentMeasurement.points!.length >= 3;
      case 'edge':
        return this.currentMeasurement.points!.length >= 2;
      default:
        return false;
    }
  }

  async finishMeasurement() {
    if (!this.currentMeasurement || !this.canFinish) return;

    try {
      const measurement = await this.measurementService.createMeasurement(
        this.roomId, 
        this.currentMeasurement
      ).toPromise();
      
      this.measurements.push(measurement);
      this.measurementCreated.emit(measurement);
      this.toastr.success('Measurement saved successfully');
      
      this.currentMeasurement = null;
    } catch (error) {
      this.toastr.error('Failed to save measurement');
      console.error('Error saving measurement:', error);
    }
  }

  cancelMeasurement() {
    this.currentMeasurement = null;
    this.angle = null;
  }

  async editMeasurement(measurement: Measurement) {
    const newLabel = prompt('Enter measurement label:', measurement.label || '');
    if (newLabel !== null) {
      try {
        const updatedMeasurement = await this.measurementService.updateMeasurement(
          this.roomId,
          measurement.id, 
          { label: newLabel }
        ).toPromise();
        
        const index = this.measurements.findIndex(m => m.id === measurement.id);
        if (index !== -1) {
          this.measurements[index] = updatedMeasurement;
          this.measurementUpdated.emit(updatedMeasurement);
        }
        
        this.toastr.success('Measurement updated');
      } catch (error) {
        this.toastr.error('Failed to update measurement');
      }
    }
  }

  async deleteMeasurement(measurement: Measurement) {
    if (confirm('Are you sure you want to delete this measurement?')) {
      try {
        await this.measurementService.deleteMeasurement(this.roomId, measurement.id).toPromise();
        this.measurements = this.measurements.filter(m => m.id !== measurement.id);
        this.measurementDeleted.emit(measurement.id);
        this.toastr.success('Measurement deleted');
      } catch (error) {
        this.toastr.error('Failed to delete measurement');
      }
    }
  }

  getInstructions(): string {
    switch (this.selectedTool) {
      case 'point_to_point':
        return 'Click on two points to measure the distance between them.';
      case 'corner':
        return 'Click on three points to measure the angle at the middle point.';
      case 'edge':
        return 'Click on points along an edge to measure its total length.';
      default:
        return 'Select a measurement tool to begin.';
    }
  }
}

