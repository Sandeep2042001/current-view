import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  getImageUrl(imagePath: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.API_URL}/upload/image/${imagePath}`);
  }

  uploadImage(roomId: string, file: File, metadata?: any): Observable<any> {
    const formData = new FormData();
    formData.append('image', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    return this.http.post(`${this.API_URL}/upload/image/${roomId}`, formData);
  }

  getUploadProgress(roomId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/upload/progress/${roomId}`);
  }

  deleteImage(imageId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/upload/image/${imageId}`);
  }
}
