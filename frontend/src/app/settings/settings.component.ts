import {Component, OnInit} from '@angular/core';
import {NavbarComponent} from "../navbar/navbar.component";
import {NgForOf, NgOptimizedImage} from "@angular/common";
import {FormsModule} from "@angular/forms"
import {SharedService} from "../services/shared.service";
import { ApiService } from "../services/api.service";

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    NavbarComponent,
    NgForOf,
    NgOptimizedImage,
    FormsModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit{
  permissions: any[] = [];

  devices: any[] = [];

  device_name: string = "";

  isExpanded: boolean = true;

  permission_modifications: any;
  original_perms: any;

  constructor(private shared: SharedService, private api: ApiService) {}

  ngOnInit() {

    this.shared.sidebarExpanded$.subscribe(expanded => {
      this.isExpanded = expanded
    });

    this.api.adminGetAllDevices().subscribe(devices => {
      this.devices = devices;
    })
  }

  openModal(device_name: string){
    this.device_name = device_name;
    this.api.getDevicePermissions(device_name).subscribe(permissions =>{
      this.permissions = permissions;
      this.original_perms = JSON.parse(JSON.stringify(permissions));
    })
  }

  getModifiedPermissions() {
    return this.permissions.filter((perm, index) => 
      perm.permission !== this.original_perms[index].permission
    );
  }

  savePermissions() {
    const modified = this.getModifiedPermissions();

    if (modified.length > 0) {
       this.api.sendModifiedPermissions(modified, this.device_name).subscribe()
    } else {
      console.log("No changes to save.");
    }
  }



  toggleSidebar() {
    this.isExpanded = !this.isExpanded;
    this.shared.setSidebarExpanded(this.isExpanded);
  }
}
