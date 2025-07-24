import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SharedService {
  private sidebarExpanded = new BehaviorSubject<boolean>(true);
  sidebarExpanded$ = this.sidebarExpanded.asObservable();

  /**
   * Shares the state of the nav bar across the script that implement this component
   * @param value
   */
  setSidebarExpanded(value: boolean) {
    this.sidebarExpanded.next(value);
  }

  /**
   * Toggle the current sidebarExpanded value (true → false, false → true)
   */
  toggleSidebar() {
    const current = this.sidebarExpanded.getValue();
    this.sidebarExpanded.next(!current);
  }
}
