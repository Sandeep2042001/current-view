import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProcessingService {
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  startStitching(roomId: string): Observable<{ message: string; jobId: string; status: string }> {
    return this.http.post<{ message: string; jobId: string; status: string }>(
      `${this.API_URL}/processing/stitch/${roomId}`, {}
    );
  }

  start3DReconstruction(projectId: string): Observable<{ message: string; jobId: string; status: string }> {
    return this.http.post<{ message: string; jobId: string; status: string }>(
      `${this.API_URL}/processing/reconstruct/${projectId}`, {}
    );
  }

  startHotspotGeneration(roomId: string): Observable<{ message: string; jobId: string; status: string }> {
    return this.http.post<{ message: string; jobId: string; status: string }>(
      `${this.API_URL}/processing/hotspots/${roomId}`, {}
    );
  }

  getJobStatus(jobId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/processing/job/${jobId}`);
  }

  getJobs(projectId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/processing/jobs/${projectId}`);
  }
}
