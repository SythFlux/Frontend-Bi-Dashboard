import {Component, OnInit} from '@angular/core';
import {NavbarComponent} from "../navbar/navbar.component";
import {SharedService} from "../services/shared.service";
import {NgOptimizedImage} from "@angular/common";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    NavbarComponent,
    NgOptimizedImage
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  isExpanded: boolean = true;

  constructor(private shared: SharedService) {}

  ngOnInit() {
    this.shared.sidebarExpanded$.subscribe(expanded => {
      this.isExpanded = expanded
    });
  }

  toggleSidebar() {
    this.isExpanded = !this.isExpanded;
    this.shared.setSidebarExpanded(this.isExpanded);
  }

}
