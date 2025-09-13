import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnnotationService } from '../../services/annotation.service';
import { ToastrService } from 'ngx-toastr';
import { Annotation } from '../../models/user.model';

@Component({
  selector: 'app-annotation-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="annotation-tools" [class.active]="isActive">
      <!-- Tool Selection -->
      <div class="tool-selection">
        <h3>Annotation Tools</h3>
        <div class="tool-buttons">
          <button 
            (click)="selectTool('point')" 
            [class.active]="selectedTool === 'point'"
            class="tool-btn">
            <i class="material-icons">place</i>
            Point
          </button>
          <button 
            (click)="selectTool('polygon')" 
            [class.active]="selectedTool === 'polygon'"
            class="tool-btn">
            <i class="material-icons">polygon</i>
            Polygon
          </button>
          <button 
            (click)="selectTool('line')" 
            [class.active]="selectedTool === 'line'"
            class="tool-btn">
            <i class="material-icons">timeline</i>
            Line
          </button>
        </div>
      </div>

      <!-- Annotation Settings -->
      <div class="annotation-settings" *ngIf="selectedTool">
        <div class="setting-group">
          <label>Color:</label>
          <div class="color-picker">
            <button 
              *ngFor="let color of colors" 
              (click)="selectColor(color)"
              [class.active]="selectedColor === color"
              [style.background-color]="color"
              class="color-btn">
            </button>
          </div>
        </div>

        <div class="setting-group">
          <label>Size:</label>
          <input 
            type="range" 
            min="1" 
            max="10" 
            [(ngModel)]="selectedSize" 
            class="size-slider">
          <span class="size-value">{{ selectedSize }}px</span>
        </div>

        <div class="setting-group">
          <label>Opacity:</label>
          <input 
            type="range" 
            min="0.1" 
            max="1" 
            step="0.1" 
            [(ngModel)]="selectedOpacity" 
            class="opacity-slider">
          <span class="opacity-value">{{ (selectedOpacity * 100) | number:'1.0-0' }}%</span>
        </div>

        <div class="setting-group">
          <label>
            <input type="checkbox" [(ngModel)]="showLabels">
            Show Labels
          </label>
        </div>
      </div>

      <!-- Active Annotation -->
      <div class="active-annotation" *ngIf="currentAnnotation">
        <h4>Current Annotation</h4>
        <div class="annotation-form">
          <div class="form-group">
            <label>Title:</label>
            <input 
              type="text" 
              [(ngModel)]="currentAnnotation.title" 
              placeholder="Enter annotation title"
              class="form-input">
          </div>
          
          <div class="form-group">
            <label>Description:</label>
            <textarea 
              [(ngModel)]="currentAnnotation.description" 
              placeholder="Enter annotation description"
              class="form-textarea"
              rows="3">
            </textarea>
          </div>

          <div class="annotation-info">
            <div class="info-item">
              <span class="info-label">Type:</span>
              <span class="info-value">{{ currentAnnotation.type | titlecase }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Points:</span>
              <span class="info-value">{{ currentAnnotation.coordinates?.length || 0 }}</span>
            </div>
            <div class="info-item" *ngIf="currentAnnotation.type === 'polygon' && polygonArea">
              <span class="info-label">Area:</span>
              <span class="info-value">{{ polygonArea | number:'1.2-2' }} m²</span>
            </div>
            <div class="info-item" *ngIf="currentAnnotation.type === 'line' && lineLength">
              <span class="info-label">Length:</span>
              <span class="info-value">{{ lineLength | number:'1.2-2' }} m</span>
            </div>
          </div>

          <div class="annotation-actions">
            <button (click)="addPoint()" 
                    [disabled]="!canAddPoint" 
                    class="action-btn primary">
              <i class="material-icons">add</i>
              Add Point
            </button>
            <button (click)="finishAnnotation()" 
                    [disabled]="!canFinish" 
                    class="action-btn success">
              <i class="material-icons">check</i>
              Finish
            </button>
            <button (click)="cancelAnnotation()" class="action-btn danger">
              <i class="material-icons">close</i>
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Annotations List -->
      <div class="annotations-list" *ngIf="annotations.length > 0">
        <h4>Saved Annotations ({{ annotations.length }})</h4>
        <div class="annotation-item" *ngFor="let annotation of annotations; let i = index">
          <div class="annotation-header">
            <div class="annotation-type" [style.color]="getAnnotationColor(annotation)">
              <i class="material-icons">{{ getAnnotationIcon(annotation.type) }}</i>
              {{ annotation.type | titlecase }}
            </div>
            <div class="annotation-actions">
              <button (click)="editAnnotation(annotation)" class="btn-icon">
                <i class="material-icons">edit</i>
              </button>
              <button (click)="deleteAnnotation(annotation)" class="btn-icon danger">
                <i class="material-icons">delete</i>
              </button>
            </div>
          </div>
          <div class="annotation-content" *ngIf="annotation.title">
            <h5 class="annotation-title">{{ annotation.title }}</h5>
            <p class="annotation-description" *ngIf="annotation.description">
              {{ annotation.description }}
            </p>
          </div>
          <div class="annotation-meta">
            <span class="annotation-points">{{ annotation.coordinates.length }} points</span>
            <span class="annotation-date">{{ formatDate(annotation.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Instructions -->
      <div class="instructions" *ngIf="selectedTool && !currentAnnotation">
        <h4>Instructions</h4>
        <div class="instruction-content" [innerHTML]="getInstructions()"></div>
      </div>
    </div>
  `,
  styleUrls: ['./annotation-tools.component.scss']
})
export class AnnotationToolsComponent implements OnInit, OnDestroy {
  @Input() roomId!: string;
  @Input() isActive = false;
  @Output() annotationCreated = new EventEmitter<Annotation>();
  @Output() annotationUpdated = new EventEmitter<Annotation>();
  @Output() annotationDeleted = new EventEmitter<string>();

  selectedTool: 'point' | 'polygon' | 'line' | null = null;
  selectedColor = '#2196F3';
  selectedSize = 3;
  selectedOpacity = 0.8;
  showLabels = true;

  colors = [
    '#2196F3', '#4CAF50', '#FF9800', '#F44336', 
    '#9C27B0', '#00BCD4', '#795548', '#607D8B'
  ];

  annotations: Annotation[] = [];
  currentAnnotation: Partial<Annotation> | null = null;
  polygonArea: number | null = null;
  lineLength: number | null = null;

  constructor(
    private annotationService: AnnotationService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadAnnotations();
  }

  ngOnDestroy() {
    this.cancelAnnotation();
  }

  async loadAnnotations() {
    try {
      this.annotations = await this.annotationService.getAnnotations(this.roomId).toPromise();
    } catch (error) {
      console.error('Error loading annotations:', error);
    }
  }

  selectTool(tool: 'point' | 'polygon' | 'line') {
    this.selectedTool = tool;
    this.startNewAnnotation();
  }

  selectColor(color: string) {
    this.selectedColor = color;
  }

  startNewAnnotation() {
    if (!this.selectedTool) return;

    this.currentAnnotation = {
      roomId: this.roomId,
      type: this.selectedTool,
      coordinates: [],
      title: '',
      description: '',
      style: {
        color: this.selectedColor,
        size: this.selectedSize,
        opacity: this.selectedOpacity,
        showLabels: this.showLabels
      }
    };
    this.polygonArea = null;
    this.lineLength = null;
  }

  addPoint() {
    if (!this.currentAnnotation) return;

    // In a real implementation, this would get the 3D coordinates from the viewer
    const point = this.getCurrentViewerPosition();
    this.currentAnnotation.coordinates!.push(point);

    this.updateAnnotationCalculations();
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

  private updateAnnotationCalculations() {
    if (!this.currentAnnotation || !this.currentAnnotation.coordinates) return;

    const coordinates = this.currentAnnotation.coordinates;
    
    if (this.currentAnnotation.type === 'polygon' && coordinates.length >= 3) {
      this.polygonArea = this.annotationService.calculatePolygonArea(coordinates);
    }

    if (this.currentAnnotation.type === 'line' && coordinates.length >= 2) {
      this.lineLength = this.annotationService.calculateLineLength(coordinates);
    }
  }

  get canAddPoint(): boolean {
    if (!this.currentAnnotation) return false;
    
    switch (this.currentAnnotation.type) {
      case 'point':
        return this.currentAnnotation.coordinates!.length < 1;
      case 'polygon':
        return true; // Can add unlimited points for polygon
      case 'line':
        return true; // Can add unlimited points for line
      default:
        return false;
    }
  }

  get canFinish(): boolean {
    if (!this.currentAnnotation) return false;
    
    switch (this.currentAnnotation.type) {
      case 'point':
        return this.currentAnnotation.coordinates!.length >= 1;
      case 'polygon':
        return this.currentAnnotation.coordinates!.length >= 3;
      case 'line':
        return this.currentAnnotation.coordinates!.length >= 2;
      default:
        return false;
    }
  }

  async finishAnnotation() {
    if (!this.currentAnnotation || !this.canFinish) return;

    try {
      const annotation = await this.annotationService.createAnnotation(
        this.roomId, 
        this.currentAnnotation
      ).toPromise();
      
      this.annotations.push(annotation);
      this.annotationCreated.emit(annotation);
      this.toastr.success('Annotation saved successfully');
      
      this.currentAnnotation = null;
    } catch (error) {
      this.toastr.error('Failed to save annotation');
      console.error('Error saving annotation:', error);
    }
  }

  cancelAnnotation() {
    this.currentAnnotation = null;
    this.polygonArea = null;
    this.lineLength = null;
  }

  async editAnnotation(annotation: Annotation) {
    const newTitle = prompt('Enter annotation title:', annotation.title || '');
    const newDescription = prompt('Enter annotation description:', annotation.description || '');
    
    if (newTitle !== null) {
      try {
        const updatedAnnotation = await this.annotationService.updateAnnotation(
          annotation.id, 
          { 
            title: newTitle,
            description: newDescription 
          }
        ).toPromise();
        
        const index = this.annotations.findIndex(a => a.id === annotation.id);
        if (index !== -1) {
          this.annotations[index] = updatedAnnotation;
          this.annotationUpdated.emit(updatedAnnotation);
        }
        
        this.toastr.success('Annotation updated');
      } catch (error) {
        this.toastr.error('Failed to update annotation');
      }
    }
  }

  async deleteAnnotation(annotation: Annotation) {
    if (confirm('Are you sure you want to delete this annotation?')) {
      try {
        await this.annotationService.deleteAnnotation(annotation.id).toPromise();
        this.annotations = this.annotations.filter(a => a.id !== annotation.id);
        this.annotationDeleted.emit(annotation.id);
        this.toastr.success('Annotation deleted');
      } catch (error) {
        this.toastr.error('Failed to delete annotation');
      }
    }
  }

  getAnnotationIcon(type: string): string {
    switch (type) {
      case 'point': return 'place';
      case 'polygon': return 'polygon';
      case 'line': return 'timeline';
      default: return 'place';
    }
  }

  getAnnotationColor(annotation: Annotation): string {
    return annotation.style?.color || '#2196F3';
  }

  getInstructions(): string {
    switch (this.selectedTool) {
      case 'point':
        return 'Click on a point to place a marker annotation.';
      case 'polygon':
        return 'Click on points to create a polygon. Click the finish button when done.';
      case 'line':
        return 'Click on points to create a line. Click the finish button when done.';
      default:
        return 'Select an annotation tool to begin.';
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
}

