import { Injectable } from '@angular/core';
import moment, { Moment } from 'moment';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  constructor() {}

  /**
   * Set the token and expiration time in sessionStorage
   * @param authResult The authentication result containing id_token and expiresIn
   */
  setSession(authResult: any): void {
    console.log("Setting Session with:", authResult);

    if (authResult && authResult.expiresIn && authResult.id_token) {
      const expiresAt = moment().add(authResult.expiresIn, 'seconds');
      sessionStorage.setItem('id_token', authResult.id_token);
      sessionStorage.setItem('expires_at', JSON.stringify(expiresAt.valueOf()));
      console.log("Session set. Expires at:", expiresAt.format());
    } else {
      console.warn("Auth result missing token or expiry, setting fallback session.");
      sessionStorage.setItem('loggedIn', 'true');  // Fallback for minimal session
    }
  }

  /**
   * Clear the session storage
   */



  logout(): void {
    sessionStorage.removeItem('id_token');
    sessionStorage.removeItem('expires_at');
    sessionStorage.removeItem('loggedIn');  
    console.log("Session cleared.");
  }

  /**
   * Check if the user is currently logged in based on expiration time
   */
  isLoggedIn(): boolean {
    const expiresAt = this.getExpiration();
    if (!expiresAt) {
      console.warn("No expiration found. User is not logged in.");
      return false;
    }
    const isValid = moment().isBefore(expiresAt);
    console.log("Login status:", isValid ? "Logged in" : "Session expired");
    return isValid;
  }



  /**
   * Dummy check for admin rights (to be implemented)
   */
  isAdmin(): boolean {

    return true;  // Placeholder
  }

  /**
   * Retrieve session expiration time from storage
   */
  private getExpiration(): Moment | null {
    const expiration = sessionStorage.getItem('expires_at');
    if (!expiration) {
      return null;
    }
    return moment(JSON.parse(expiration));
  }
}
