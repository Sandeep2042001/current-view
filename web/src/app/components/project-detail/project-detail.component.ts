import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { ProcessingService } from '../../services/processing.service';
import { ToastrService } from 'ngx-toastr';
import { Project, Room } from '../../models/user.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="project-detail-container">
      <!-- Project Header -->
      <div class="project-header">
        <div class="header-content">
          <div class="project-info">
            <h1>{{ project?.name }}</h1>
            <p class="project-description">{{ project?.description || 'No description' }}</p>
            <div class="project-meta">
              <span class="status-badge" [class]="'status-' + project?.status">
                {{ project?.status | titlecase }}
              </span>
              <span class="created-date">
                Created {{ formatDate(project?.created_at) }}
              </span>
            </div>
          </div>
          
          <div class="project-actions">
            <button (click)="startProcessing()" 
                    [disabled]="!canStartProcessing" 
                    class="action-btn primary">
              <i class="material-icons">build</i>
              Start Processing
            </button>
            <button (click)="viewIn3D()" 
                    [disabled]="!has3DModel" 
                    class="action-btn secondary">
              <i class="material-icons">view_in_ar</i>
              View 3D Model
            </button>
            <button (click)="exportProject()" class="action-btn secondary">
              <i class="material-icons">download</i>
              Export
            </button>
          </div>
        </div>
      </div>

      <!-- Processing Status -->
      <div class="processing-status" *ngIf="processingJobs.length > 0">
        <h3>Processing Status</h3>
        <div class="jobs-list">
          <div *ngFor="let job of processingJobs" class="job-item">
            <div class="job-info">
              <span class="job-type">{{ job.type | titlecase }}</span>
              <span class="job-status" [class]="'status-' + job.status">
                {{ job.status | titlecase }}
              </span>
            </div>
            <div class="job-progress" *ngIf="job.status === 'processing'">
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="job.progress || 0"></div>
              </div>
            </div>
            <div class="job-time">
              <span *ngIf="job.started_at">
                Started: {{ formatDate(job.started_at) }}
              </span>
              <span *ngIf="job.completed_at">
                Completed: {{ formatDate(job.completed_at) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Rooms Section -->
      <div class="rooms-section">
        <div class="section-header">
          <h2>Rooms ({{ rooms.length }})</h2>
          <button (click)="addRoom()" class="add-btn">
            <i class="material-icons">add</i>
            Add Room
          </button>
        </div>

        <div class="rooms-grid" *ngIf="rooms.length > 0; else noRooms">
          <div *ngFor="let room of rooms" 
               class="room-card" 
               (click)="openRoom(room)">
            
            <!-- Room Image -->
            <div class="room-image">
              <div class="image-placeholder" *ngIf="!room.metadata?.['preview_image']">
                <i class="material-icons">room</i>
              </div>
              <img *ngIf="room.metadata?.['preview_image']" 
                   [src]="room.metadata?.['preview_image']" 
                   [alt]="room.name">
              
              <!-- Status Badge -->
              <div class="status-badge" [class]="'status-' + room.status">
                {{ room.status | titlecase }}
              </div>
            </div>

            <!-- Room Info -->
            <div class="room-info">
              <h3 class="room-name">{{ room.name }}</h3>
              <p class="room-description">{{ room.description || 'No description' }}</p>
              
              <div class="room-stats">
                <div class="stat">
                  <i class="material-icons">photo</i>
                  <span>{{ room.images?.length || 0 }} images</span>
                </div>
                <div class="stat">
                  <i class="material-icons">place</i>
                  <span>{{ room.hotspots?.length || 0 }} hotspots</span>
                </div>
              </div>
            </div>

            <!-- Room Actions -->
            <div class="room-actions">
              <button (click)="viewRoom(room); $event.stopPropagation()" 
                      class="room-btn primary">
                <i class="material-icons">visibility</i>
                View
              </button>
              <button (click)="editRoom(room); $event.stopPropagation()" 
                      class="room-btn secondary">
                <i class="material-icons">edit</i>
                Edit
              </button>
              <button (click)="deleteRoom(room); $event.stopPropagation()" 
                      class="room-btn danger">
                <i class="material-icons">delete</i>
                Delete
              </button>
            </div>
          </div>
        </div>

        <ng-template #noRooms>
          <div class="empty-rooms">
            <div class="empty-icon">
              <i class="material-icons">room</i>
            </div>
            <h3>No Rooms Yet</h3>
            <p>Add rooms to start capturing 360° images and creating your interactive walkthrough.</p>
            <button (click)="addRoom()" class="add-first-btn">
              <i class="material-icons">add</i>
              Add Your First Room
            </button>
          </div>
        </ng-template>
      </div>

      <!-- 3D Model Section -->
      <div class="model-section" *ngIf="has3DModel">
        <h2>3D Model</h2>
        <div class="model-info">
          <div class="model-preview">
            <div class="preview-placeholder">
              <i class="material-icons">view_in_ar</i>
              <p>3D Model Available</p>
            </div>
          </div>
          <div class="model-details">
            <h3>Reconstruction Details</h3>
            <div class="model-stats">
              <div class="stat">
                <span class="label">Vertices:</span>
                <span class="value">{{ project?.metadata?.['model_vertices'] || 0 }}</span>
              </div>
              <div class="stat">
                <span class="label">Faces:</span>
                <span class="value">{{ project?.metadata?.['model_faces'] || 0 }}</span>
              </div>
              <div class="stat">
                <span class="label">Quality:</span>
                <span class="value">{{ (project?.metadata?.['reconstruction_quality']?.overall || 0) * 100 | number:'1.0-0' }}%</span>
              </div>
            </div>
            <button (click)="viewIn3D()" class="view-model-btn">
              <i class="material-icons">view_in_ar</i>
              View 3D Model
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./project-detail.component.scss']
})
export class ProjectDetailComponent implements OnInit {
  projectId!: string;
  project: Project | null = null;
  rooms: Room[] = [];
  processingJobs: any[] = [];
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private processingService: ProcessingService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.projectId = params['id'];
      this.loadProject();
    });
  }

  async loadProject() {
    try {
      this.loading = true;
      this.project = await this.projectService.getProject(this.projectId).toPromise() || null;
      this.rooms = this.project?.rooms || [];
      await this.loadProcessingJobs();
    } catch (error) {
      this.toastr.error('Failed to load project');
      console.error('Error loading project:', error);
    } finally {
      this.loading = false;
    }
  }

  async loadProcessingJobs() {
    try {
      this.processingJobs = await this.processingService.getJobs(this.projectId).toPromise() || [];
    } catch (error) {
      console.error('Error loading processing jobs:', error);
    }
  }

  get canStartProcessing(): boolean {
    return this.rooms.some(room => room.status === 'completed') && 
           this.processingJobs.every(job => job.status !== 'processing');
  }

  get has3DModel(): boolean {
    return this.project?.metadata?.['has_3d_model'] === true;
  }

  async startProcessing() {
    try {
      // Check for rooms that need processing
      const pendingRooms = this.rooms.filter(room => room.status === 'pending' && room.images && room.images.length > 0);
      const completedRooms = this.rooms.filter(room => room.status === 'completed');
      
      if (pendingRooms.length > 0) {
        const confirmProcess = confirm(
          `Found ${pendingRooms.length} rooms ready for processing.\n\n` +
          'This will start stitching for all rooms with images. Continue?'
        );
        
        if (!confirmProcess) return;
        
        // Process all pending rooms
        for (const room of pendingRooms) {
          if (room.images && room.images.length === 1) {
            // Single image - mark as completed
            room.status = 'completed';
            this.toastr.success(`Room "${room.name}" processed (single image)`);
          } else if (room.images && room.images.length > 1) {
            // Multiple images - start stitching
            try {
              await this.processingService.startStitching(room.id).toPromise();
              this.toastr.success(`Stitching started for room "${room.name}"`);
            } catch (error) {
              console.error(`Failed to start stitching for room ${room.name}:`, error);
              this.toastr.warning(`Skipped room "${room.name}" - processing failed`);
            }
          }
        }
        
        await this.loadProcessingJobs();
        return;
      }
      
      if (completedRooms.length === 0) {
        this.toastr.warning('No rooms available for processing. Please upload images to rooms first.');
        return;
      }

      // Start 3D reconstruction for completed rooms
      const confirm3D = confirm(
        `Start 3D model generation for ${completedRooms.length} completed rooms?`
      );
      
      if (confirm3D) {
        await this.processingService.start3DReconstruction(this.projectId).toPromise();
        this.toastr.success('3D reconstruction started');
        await this.loadProcessingJobs();
      }
    } catch (error) {
      this.toastr.error('Failed to start processing');
      console.error('Error starting processing:', error);
    }
  }

  viewIn3D() {
    // TODO: Implement 3D model viewer
    this.toastr.info('3D model viewer coming soon!');
  }

  exportProject() {
    if (!this.project) return;
    
    // Create export data
    const exportData = {
      project: {
        id: this.project.id,
        name: this.project.name,
        description: this.project.description,
        created_at: this.project.created_at,
        metadata: this.project.metadata
      },
      rooms: this.rooms.map(room => ({
        id: room.id,
        name: room.name,
        description: room.description,
        status: room.status,
        images_count: room.images?.length || 0,
        hotspots_count: room.hotspots?.length || 0,
        created_at: room.created_at
      })),
      processing_jobs: this.processingJobs,
      export_timestamp: new Date().toISOString()
    };
    
    // Download as JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${this.project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.json`;
    link.click();
    
    this.toastr.success('Project data exported successfully!');
  }

  addRoom() {
    const name = prompt('Enter room name:');
    if (name && name.trim()) {
      this.createRoom(name.trim());
    }
  }

  async createRoom(name: string) {
    try {
      const room = await this.projectService.createRoom(this.projectId, { name }).toPromise();
      if (room) {
        this.rooms.push(room);
      }
      this.toastr.success('Room created successfully');
    } catch (error) {
      this.toastr.error('Failed to create room');
      console.error('Error creating room:', error);
    }
  }

  openRoom(room: Room) {
    this.router.navigate(['/projects', this.projectId, 'rooms', room.id]);
  }

  viewRoom(room: Room) {
    this.router.navigate(['/viewer', this.projectId, room.id]);
  }

  editRoom(room: Room) {
    // TODO: Implement room editing
    this.toastr.info('Room editing feature coming soon!');
  }

  async deleteRoom(room: Room) {
    if (confirm(`Are you sure you want to delete "${room.name}"?`)) {
      try {
        // TODO: Implement room deletion API
        this.rooms = this.rooms.filter(r => r.id !== room.id);
        this.toastr.success('Room deleted successfully');
      } catch (error) {
        this.toastr.error('Failed to delete room');
        console.error('Error deleting room:', error);
      }
    }
  }

  formatDate(dateString: string | undefined): string {
    return dateString ? new Date(dateString).toLocaleDateString() : 'Unknown';
  }
}
