import { Component, Output, EventEmitter } from '@angular/core';
import {NavigationEnd, Router, RouterLink} from "@angular/router";
import {SharedService} from "../services/shared.service";
import {SessionService} from "../services/session.service";
import {bootstrapApplication} from "@angular/platform-browser";
import {NgIf} from "@angular/common";

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    NgIf
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  @Output() sidebarTransitionEnd: EventEmitter<void> = new EventEmitter<void>();

  currentRoute: string = "/";
  isExpanded: boolean = true;
  admin: boolean = true;

  constructor(private router: Router, private shared: SharedService, private session: SessionService) {
    this.router.events.subscribe((event) => {
      if(event instanceof NavigationEnd) {
        this.currentRoute = event.url;
        console.log(this.currentRoute)
      }
    });
    this.shared.sidebarExpanded$.subscribe(value => {
      this.isExpanded = value;
    })
  }

  onSidebarTransitionEnd() {
    this.sidebarTransitionEnd.emit();
  }

  logout() {
    this.session.logout();
  }
}
