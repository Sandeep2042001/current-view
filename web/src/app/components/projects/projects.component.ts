import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Project } from '../../models/user.model';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="projects-container">
      <!-- Header -->
      <div class="projects-header">
        <div class="header-content">
          <h1>My Projects</h1>
          <button (click)="createNewProject()" class="create-btn">
            <i class="material-icons">add</i>
            New Project
          </button>
        </div>
      </div>

      <!-- Projects Grid -->
      <div class="projects-grid" *ngIf="projects.length > 0; else emptyState">
        <div *ngFor="let project of projects" 
             class="project-card" 
             (click)="openProject(project)">
          
          <!-- Project Image -->
          <div class="project-image">
            <div class="image-placeholder" *ngIf="!project.metadata?.['preview_image']">
              <i class="material-icons">360</i>
            </div>
            <img *ngIf="project.metadata?.['preview_image']" 
                 [src]="project.metadata?.['preview_image']" 
                 [alt]="project.name">
            
            <!-- Status Badge -->
            <div class="status-badge" [class]="'status-' + project.status">
              {{ project.status | titlecase }}
            </div>
          </div>

          <!-- Project Info -->
          <div class="project-info">
            <h3 class="project-name">{{ project.name }}</h3>
            <p class="project-description">{{ project.description || 'No description' }}</p>
            
            <div class="project-stats">
              <div class="stat">
                <i class="material-icons">room</i>
                <span>{{ project.room_count || 0 }} rooms</span>
              </div>
              <div class="stat">
                <i class="material-icons">schedule</i>
                <span>{{ formatDate(project.createdAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Project Actions -->
          <div class="project-actions">
            <button (click)="openProject(project); $event.stopPropagation()" 
                    class="action-btn primary">
              <i class="material-icons">visibility</i>
              View
            </button>
            <button (click)="editProject(project); $event.stopPropagation()" 
                    class="action-btn secondary">
              <i class="material-icons">edit</i>
              Edit
            </button>
            <button (click)="deleteProject(project); $event.stopPropagation()" 
                    class="action-btn danger">
              <i class="material-icons">delete</i>
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <ng-template #emptyState>
        <div class="empty-state">
          <div class="empty-icon">
            <i class="material-icons">folder_open</i>
          </div>
          <h2>No Projects Yet</h2>
          <p>Create your first 360° project to get started with interactive walkthroughs.</p>
          <button (click)="createNewProject()" class="create-first-btn">
            <i class="material-icons">add</i>
            Create Your First Project
          </button>
        </div>
      </ng-template>

      <!-- Create Project Modal -->
      <div class="modal-overlay" *ngIf="showCreateModal" (click)="closeCreateModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Create New Project</h2>
            <button (click)="closeCreateModal()" class="modal-close">
              <i class="material-icons">close</i>
            </button>
          </div>
          
          <form [formGroup]="createForm" (ngSubmit)="onCreateSubmit()" class="modal-body">
            <div class="form-group">
              <label for="name">Project Name</label>
              <input 
                type="text" 
                id="name" 
                formControlName="name" 
                placeholder="Enter project name"
                class="form-input">
            </div>
            
            <div class="form-group">
              <label for="description">Description (Optional)</label>
              <textarea 
                id="description" 
                formControlName="description" 
                placeholder="Enter project description"
                class="form-textarea"
                rows="3"></textarea>
            </div>
            
            <div class="form-actions">
              <button type="button" (click)="closeCreateModal()" class="btn secondary">
                Cancel
              </button>
              <button type="submit" [disabled]="createForm.invalid || creating" class="btn primary">
                {{ creating ? 'Creating...' : 'Create Project' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./projects.component.scss']
})
export class ProjectsComponent implements OnInit {
  projects: Project[] = [];
  loading = false;
  showCreateModal = false;
  creating = false;

  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['']
  });

  constructor(
    private projectService: ProjectService,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.loadProjects();
  }

  async loadProjects() {
    try {
      this.loading = true;
      this.projects = await this.projectService.getProjects().toPromise() || [];
    } catch (error) {
      this.toastr.error('Failed to load projects');
      console.error('Error loading projects:', error);
    } finally {
      this.loading = false;
    }
  }

  createNewProject() {
    this.createForm.reset();
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.createForm.reset();
  }

  async onCreateSubmit() {
    if (this.createForm.valid) {
      try {
        this.creating = true;
        const formValue = this.createForm.value;
        const projectData = {
          name: formValue.name || '',
          description: formValue.description || ''
        };
        const project = await this.projectService.createProject(projectData).toPromise();
        if (project) {
          this.projects.unshift(project);
        }
        this.closeCreateModal();
        this.toastr.success('Project created successfully!');
      } catch (error) {
        this.toastr.error('Failed to create project');
        console.error('Error creating project:', error);
      } finally {
        this.creating = false;
      }
    }
  }

  openProject(project: Project) {
    this.router.navigate(['/projects', project.id]);
  }

  editProject(project: Project) {
    // TODO: Implement edit project functionality
    this.toastr.info('Edit project feature coming soon!');
  }

  async deleteProject(project: Project) {
    if (confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      try {
        await this.projectService.deleteProject(project.id).toPromise();
        this.projects = this.projects.filter(p => p.id !== project.id);
        this.toastr.success('Project deleted successfully');
      } catch (error) {
        this.toastr.error('Failed to delete project');
        console.error('Error deleting project:', error);
      }
    }
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      return 'Invalid Date';
    }
  }
}
