import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { RoomCreateResponse, RoomJoinResponse, RoomStateResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class GameService {
  constructor(private readonly http: HttpClient) {}

  createRoom(username: string): Observable<RoomCreateResponse> {
    return this.http.post<RoomCreateResponse>(`${environment.apiUrl}/rooms/create`, { username });
  }

  joinRoom(code: string, username: string): Observable<RoomJoinResponse> {
    return this.http.post<RoomJoinResponse>(`${environment.apiUrl}/rooms/join/${code}`, { username });
  }

  playVsAi(code: string, username: string): Observable<RoomStateResponse> {
    return this.http.post<RoomStateResponse>(`${environment.apiUrl}/rooms/${code}/vs-ai`, { username });
  }

  getRoom(code: string): Observable<RoomStateResponse> {
    return this.http.get<RoomStateResponse>(`${environment.apiUrl}/rooms/${code}`);
  }
}
