import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NavbarComponent } from "../navbar/navbar.component";
import { SharedService } from "../services/shared.service";
import { NgForOf, NgIf, NgOptimizedImage } from "@angular/common";
import { Clipboard } from "@angular/cdk/clipboard";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { Device } from "../models/device.model";
import { ApiService } from "../services/api.service";
import { Measurements } from "../models/measurments.model";
import forge from "node-forge";
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";

declare var bootstrap: any;

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [
    NavbarComponent,
    NgForOf,
    NgOptimizedImage,
    NgIf,
    ReactiveFormsModule
  ],
  templateUrl: './devices.component.html',
  styleUrls: ['./devices.component.css']
})
export class DevicesComponent implements OnInit {

  deviceForm!: FormGroup;

  devices: Device[] = [];
  measurements: Measurements[] = [];

  deviceName: string = "Test";
  latestKey: string = "";
  newAPIKey: boolean = false;
  showInfo: boolean = false;

  isExpanded: boolean = true;
  deviceData: any;

  isLoadingDevices: boolean = true;
  error: string | null = null;

  updateToast: HTMLElement | null = null;

  constructor(private shared: SharedService, private clipboard: Clipboard, private modalService: NgbModal, private api: ApiService, private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.showInfo = false;
    const toastTrigger = document.getElementById("reset-device-btn") as HTMLElement;
    const toastLive = document.getElementById("liveToast");
    this.updateToast = document.getElementById("updateToast") as HTMLElement;
    console.log(toastTrigger);
    if (toastTrigger) {
      toastTrigger.addEventListener('click', () => {
        const toast = new bootstrap.Toast(toastLive);
        toast.show();
      })
    }
    this.shared.sidebarExpanded$.subscribe(expanded => {
      this.isExpanded = expanded
    });

    const nonCopyableField = document.getElementById('button-addon1');
    if (nonCopyableField) {
      nonCopyableField.addEventListener('copy', (event) => {
        event.preventDefault();
      });
    }

    this.fetchDevices();

    this.deviceForm = new FormGroup({
      deviceName: new FormControl('', [Validators.required]),
      deviceDescription: new FormControl('')
    })
  }

  fetchDevices() {
    this.api.getAllDevices().subscribe({
      next: devices => {
        this.devices = devices;
        this.isLoadingDevices = false;
        this.cdr.detectChanges(); // Force change detection
      },
      error: err => {
        this.error = 'Failed to load devices';
        this.isLoadingDevices = false;
        this.cdr.detectChanges(); // Force change detection
      }
    });
  }

  triggerUpdateToast() {
    const toast = new bootstrap.Toast(this.updateToast);
    toast.show();
  }

  toggleSidebar() {
    this.isExpanded = !this.isExpanded;
    this.shared.setSidebarExpanded(this.isExpanded);
  }

  copyToClipboard(event: Event): void {
    event.preventDefault();
    this.clipboard.copy(this.latestKey);
  }

  openModal(content: any, device: any) {
    console.log(content);
    this.deviceData = device;
    this.modalService.open(content);
  }

  saveDevice() {
    const imageButtons = document.querySelectorAll('input[name="image-choice"]') as NodeListOf<HTMLInputElement>;
    let selectedImgFilename: string | null = null;

    imageButtons.forEach(imageButton => {
      if (imageButton.checked) {
        const imgElement = imageButton.nextElementSibling as HTMLImageElement;
        if (imgElement) {
          const src = imgElement.src;
          selectedImgFilename = src.substring(src.lastIndexOf('/') + 1);
        }
      }
    });

    const newDevice = {
      name: this.deviceForm.value.deviceName,
      description: this.deviceForm.value.deviceDescription,
    }

    this.api.createNewDevice(newDevice).subscribe({
      next: (responce) => {
        this.showInfo = true;
        this.latestKey = responce.body.new_api_key;
        this.deviceName = this.deviceForm.value.deviceName;
        console.log(responce.body);
        this.fetchDevices();
        this.cdr.detectChanges(); // Force change detection
      },
      error: () => {
        this.fetchDevices();
        this.cdr.detectChanges(); // Force change detection
      }
    });
  }

  resetAlert(){
    this.latestKey = "";
  }

  updateMotor(device: Device, index: number) {
    this.triggerUpdateToast();
    // this.api.updateDevice(device).subscribe({
    //   next: () => this.fetchDevices(),
    //   error: () => this.fetchDevices()
    // });
  }

  deleteDevice(device_id: number) {
    this.api.deleteDevice(device_id).subscribe({
      next: () => {
        this.fetchDevices();
        this.cdr.detectChanges(); // Force change detection
      },
      error: () => {
        this.fetchDevices();
        this.cdr.detectChanges(); // Force change detection
      }
    });
  }

  updateDevice(device: Device) {
    const deviceNameRef = document.getElementById("edit-device-name") as HTMLInputElement;
    const deviceDescriptionRef = document.getElementById("edit-device-description") as HTMLInputElement;
    const imageButtons = document.querySelectorAll('input[name="image-choice"]') as NodeListOf<HTMLInputElement>;
    let selectedImgFilename: string | null = null;

    let newDevice = {
      name: deviceNameRef.value,
      description: deviceDescriptionRef.value,
    }

    this.triggerUpdateToast();
    this.api.updateDevice(newDevice, device.name).subscribe({
      next: () => {
        this.fetchDevices();
        this.cdr.detectChanges(); // Force change detection
      },
      error: () => {
        this.fetchDevices();
        this.cdr.detectChanges(); // Force change detection
      }
    });
  }

}
