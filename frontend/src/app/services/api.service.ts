import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';
import { EncryptionService } from './encryption.service';

// Remove the import of Device since we won’t use a typed model here
// import { Device } from '../models/device.model';
import { Measurements } from '../models/measurments.model';
import { User } from '../models/user.model';
import { SensorData } from '../models/sensordata.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl: string = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private session: SessionService,
    private encryption: EncryptionService
  ) {}

  /** LOGIN */
  loginUser(username: string, password: string): Observable<boolean> {
    const httpBody = { username, password };
    const headers = { 'Content-Type': 'application/json' };

    return this.http.post<any>(`${this.baseUrl}/api/login`, JSON.stringify(httpBody), { headers, observe: 'response' }).pipe(
      map((response: HttpResponse<any>) => {
        console.log("Login response:", response);
        this.session.setSession(response.body);
        return response.status === 200;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Login error:', error);
        return of(false);
      })
    );
  }


  getAllDevices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/devices`);
  }

  adminGetAllDevices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/admin/devices`);
  }

  getDeviceById(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/device/${id}`);
  }

  createNewDevice(device: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post(`${this.baseUrl}/api/devices/create`, JSON.stringify(device), { headers, observe: 'response' });
  }

  deleteDevice(device_id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/devices/delete/${device_id}`, { observe: 'response' });
  }

  updateDevice(device: any, name: string): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.put(`${this.baseUrl}/api/devices/update/${name}`, JSON.stringify(device), { headers, observe: 'response' });
  }

  /** OPTIONS */

  getDevicePermissions(device_name: any): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/device/perms/${device_name}`);
  }

  sendModifiedPermissions(changes: any, device_name: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(`${this.baseUrl}/api/device/perms/${device_name}/modify`, changes, { observe: 'response' });
  }

  /** USERS */
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/api/users`);
  }

  createNewUser(username: any, email: any, password: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post(`${this.baseUrl}/api/users/create`, JSON.stringify({username: username, email: email, password:password}), { headers });
  }

  editUser(last_email: any, new_name: any, new_email: any, new_password: any): Observable<any>{
    const headers = new HttpHeaders({'Content-Type': 'application/json'});
    return this.http.post(`${this.baseUrl}/api/users/edit`, JSON.stringify({last_email: last_email,username: new_name, email: new_email, password:new_password}), { headers });
  }

  deleteUser(username: any): Observable<any>{
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post(`${this.baseUrl}/api/users/delete`, JSON.stringify({username: username}), {headers});
  }

  /** TEST DATA (Deprecated) */
  getDummyData(): Observable<Partial<SensorData>[]> {
    return this.http.get<Partial<SensorData>[]>(`${this.baseUrl}/api/test`);
  }

  // In api.service.ts
  getMeasurements(field: string, deviceId: string, start: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.baseUrl}/api/measurements?fields=${field}&device_id=${deviceId}&start=${start}`
    );
  }

  
}
