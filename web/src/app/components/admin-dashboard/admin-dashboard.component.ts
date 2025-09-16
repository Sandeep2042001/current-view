import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { interval, Subscription } from 'rxjs';

interface SystemStats {
  total_users: number;
  total_projects: number;
  total_rooms: number;
  total_images: number;
  pending_jobs: number;
  processing_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
}

interface ProcessingJob {
  id: string;
  project_id: string;
  type: string;
  status: string;
  input_data: any;
  output_data: any;
  error_message: string;
  started_at: string;
  completed_at: string;
  created_at: string;
  project_name: string;
  user_email: string;
}

interface SystemHealth {
  database: string;
  redis: string;
  minio: string;
  overall: string;
  timestamp: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-dashboard">
      <!-- Header -->
      <div class="dashboard-header">
        <h1>Admin Dashboard</h1>
        <div class="header-actions">
          <button (click)="refreshData()" class="refresh-btn" [disabled]="loading">
            <i class="material-icons">refresh</i>
            Refresh
          </button>
          <button (click)="clearFailedJobs()" class="clear-btn" [disabled]="loading">
            <i class="material-icons">clear_all</i>
            Clear Failed Jobs
          </button>
        </div>
      </div>

      <!-- System Health -->
      <div class="health-section">
        <h2>System Health</h2>
        <div class="health-cards">
          <div class="health-card" [class]="'health-' + systemHealth?.database">
            <div class="health-icon">
              <i class="material-icons">storage</i>
            </div>
            <div class="health-info">
              <h3>Database</h3>
              <p>{{ systemHealth?.database | titlecase }}</p>
            </div>
          </div>
          
          <div class="health-card" [class]="'health-' + systemHealth?.redis">
            <div class="health-icon">
              <i class="material-icons">memory</i>
            </div>
            <div class="health-info">
              <h3>Redis</h3>
              <p>{{ systemHealth?.redis | titlecase }}</p>
            </div>
          </div>
          
          <div class="health-card" [class]="'health-' + systemHealth?.minio">
            <div class="health-icon">
              <i class="material-icons">cloud_upload</i>
            </div>
            <div class="health-info">
              <h3>MinIO</h3>
              <p>{{ systemHealth?.minio | titlecase }}</p>
            </div>
          </div>
          
          <div class="health-card" [class]="'health-' + systemHealth?.overall">
            <div class="health-icon">
              <i class="material-icons">monitor_heart</i>
            </div>
            <div class="health-info">
              <h3>Overall</h3>
              <p>{{ systemHealth?.overall | titlecase }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Statistics -->
      <div class="stats-section">
        <h2>System Statistics</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">
              <i class="material-icons">people</i>
            </div>
            <div class="stat-content">
              <h3>{{ systemStats?.total_users || 0 }}</h3>
              <p>Total Users</p>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="material-icons">folder</i>
            </div>
            <div class="stat-content">
              <h3>{{ systemStats?.total_projects || 0 }}</h3>
              <p>Total Projects</p>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="material-icons">room</i>
            </div>
            <div class="stat-content">
              <h3>{{ systemStats?.total_rooms || 0 }}</h3>
              <p>Total Rooms</p>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="material-icons">photo</i>
            </div>
            <div class="stat-content">
              <h3>{{ systemStats?.total_images || 0 }}</h3>
              <p>Total Images</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Processing Jobs -->
      <div class="jobs-section">
        <h2>Processing Jobs</h2>
        <div class="jobs-tabs">
          <button 
            (click)="selectedJobTab = 'all'" 
            [class.active]="selectedJobTab === 'all'"
            class="tab-btn">
            All ({{ processingJobs.length }})
          </button>
          <button 
            (click)="selectedJobTab = 'pending'" 
            [class.active]="selectedJobTab === 'pending'"
            class="tab-btn">
            Pending ({{ systemStats?.pending_jobs || 0 }})
          </button>
          <button 
            (click)="selectedJobTab = 'processing'" 
            [class.active]="selectedJobTab === 'processing'"
            class="tab-btn">
            Processing ({{ systemStats?.processing_jobs || 0 }})
          </button>
          <button 
            (click)="selectedJobTab = 'failed'" 
            [class.active]="selectedJobTab === 'failed'"
            class="tab-btn">
            Failed ({{ systemStats?.failed_jobs || 0 }})
          </button>
        </div>

        <div class="jobs-table">
          <div class="table-header">
            <div class="col-id">ID</div>
            <div class="col-type">Type</div>
            <div class="col-status">Status</div>
            <div class="col-project">Project</div>
            <div class="col-user">User</div>
            <div class="col-created">Created</div>
            <div class="col-duration">Duration</div>
            <div class="col-actions">Actions</div>
          </div>
          
          <div class="table-body">
            <div *ngFor="let job of filteredJobs" class="table-row">
              <div class="col-id">
                <span class="job-id">{{ job.id.substring(0, 8) }}...</span>
              </div>
              <div class="col-type">
                <span class="job-type">{{ job.type | titlecase }}</span>
              </div>
              <div class="col-status">
                <span class="status-badge" [class]="'status-' + job.status">
                  {{ job.status | titlecase }}
                </span>
              </div>
              <div class="col-project">
                <span class="project-name">{{ job.project_name || 'Unknown' }}</span>
              </div>
              <div class="col-user">
                <span class="user-email">{{ job.user_email || 'Unknown' }}</span>
              </div>
              <div class="col-created">
                <span class="created-time">{{ formatDate(job.created_at) }}</span>
              </div>
              <div class="col-duration">
                <span class="duration">{{ calculateDuration(job) }}</span>
              </div>
              <div class="col-actions">
                <button (click)="viewJobDetails(job)" class="action-btn">
                  <i class="material-icons">visibility</i>
                </button>
                <button (click)="retryJob(job)" 
                        *ngIf="job.status === 'failed'"
                        class="action-btn retry">
                  <i class="material-icons">refresh</i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Queue Status -->
      <div class="queue-section">
        <h2>Queue Status</h2>
        <div class="queue-info">
          <div class="queue-item">
            <span class="queue-label">Queue Length:</span>
            <span class="queue-value">{{ queueStatus?.queueLength || 0 }}</span>
          </div>
          <div class="queue-item">
            <span class="queue-label">Recent Items:</span>
            <span class="queue-value">{{ queueStatus?.recentItems?.length || 0 }}</span>
          </div>
        </div>
      </div>

      <!-- Job Details Modal -->
      <div class="modal-overlay" *ngIf="selectedJob" (click)="closeJobDetails()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Job Details</h3>
            <button (click)="closeJobDetails()" class="modal-close">
              <i class="material-icons">close</i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="job-details">
              <div class="detail-row">
                <span class="detail-label">ID:</span>
                <span class="detail-value">{{ selectedJob.id }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Type:</span>
                <span class="detail-value">{{ selectedJob.type | titlecase }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value status-badge" [class]="'status-' + selectedJob.status">
                  {{ selectedJob.status | titlecase }}
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Project:</span>
                <span class="detail-value">{{ selectedJob.project_name }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">User:</span>
                <span class="detail-value">{{ selectedJob.user_email }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Created:</span>
                <span class="detail-value">{{ formatDate(selectedJob.created_at) }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedJob.started_at">
                <span class="detail-label">Started:</span>
                <span class="detail-value">{{ formatDate(selectedJob.started_at) }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedJob.completed_at">
                <span class="detail-label">Completed:</span>
                <span class="detail-value">{{ formatDate(selectedJob.completed_at) }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedJob.error_message">
                <span class="detail-label">Error:</span>
                <span class="detail-value error">{{ selectedJob.error_message }}</span>
              </div>
            </div>
            
            <div class="job-data" *ngIf="selectedJob.input_data">
              <h4>Input Data</h4>
              <pre>{{ selectedJob.input_data | json }}</pre>
            </div>
            
            <div class="job-data" *ngIf="selectedJob.output_data">
              <h4>Output Data</h4>
              <pre>{{ selectedJob.output_data | json }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private readonly API_URL = 'http://localhost:3000/api';
  private refreshSubscription?: Subscription;

  systemStats: SystemStats | null = null;
  systemHealth: SystemHealth | null = null;
  processingJobs: ProcessingJob[] = [];
  queueStatus: any = null;
  selectedJob: ProcessingJob | null = null;
  selectedJobTab = 'all';
  loading = false;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadDashboardData();
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  private startAutoRefresh() {
    this.refreshSubscription = interval(30000).subscribe(() => {
      this.loadDashboardData();
    });
  }

  async loadDashboardData() {
    try {
      this.loading = true;
      await Promise.all([
        this.loadSystemStats(),
        this.loadSystemHealth(),
        this.loadProcessingJobs(),
        this.loadQueueStatus()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      this.loading = false;
    }
  }

  private async loadSystemStats() {
    try {
      this.systemStats = await this.http.get<SystemStats>(`${this.API_URL}/admin/stats`).toPromise() || null;
    } catch (error) {
      console.error('Error loading system stats:', error);
    }
  }

  private async loadSystemHealth() {
    try {
      this.systemHealth = await this.http.get<SystemHealth>(`${this.API_URL}/admin/health`).toPromise() || null;
    } catch (error) {
      console.error('Error loading system health:', error);
    }
  }

  private async loadProcessingJobs() {
    try {
      this.processingJobs = await this.http.get<ProcessingJob[]>(`${this.API_URL}/admin/jobs`).toPromise() || [];
    } catch (error) {
      console.error('Error loading processing jobs:', error);
    }
  }

  private async loadQueueStatus() {
    try {
      this.queueStatus = await this.http.get(`${this.API_URL}/admin/queue`).toPromise();
    } catch (error) {
      console.error('Error loading queue status:', error);
    }
  }

  get filteredJobs(): ProcessingJob[] {
    if (this.selectedJobTab === 'all') {
      return this.processingJobs;
    }
    return this.processingJobs.filter(job => job.status === this.selectedJobTab);
  }

  refreshData() {
    this.loadDashboardData();
  }

  async clearFailedJobs() {
    if (confirm('Are you sure you want to clear all failed jobs?')) {
      try {
        await this.http.post(`${this.API_URL}/admin/jobs/clear-failed`, {}).toPromise();
        this.toastr.success('Failed jobs cleared successfully');
        this.loadProcessingJobs();
      } catch (error) {
        this.toastr.error('Failed to clear failed jobs');
        console.error('Error clearing failed jobs:', error);
      }
    }
  }

  viewJobDetails(job: ProcessingJob) {
    this.selectedJob = job;
  }

  closeJobDetails() {
    this.selectedJob = null;
  }

  async retryJob(job: ProcessingJob) {
    if (confirm('Are you sure you want to retry this job?')) {
      try {
        // TODO: Implement job retry API
        this.toastr.info('Job retry feature coming soon!');
      } catch (error) {
        this.toastr.error('Failed to retry job');
      }
    }
  }

  calculateDuration(job: ProcessingJob): string {
    if (!job.started_at) return '-';
    
    const start = new Date(job.started_at);
    const end = job.completed_at ? new Date(job.completed_at) : new Date();
    const duration = end.getTime() - start.getTime();
    
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }
}

