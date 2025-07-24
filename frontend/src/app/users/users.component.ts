import {Component, OnInit, TemplateRef} from '@angular/core';
import {NavbarComponent} from "../navbar/navbar.component";
import {SharedService} from "../services/shared.service";
import {NgForOf, NgIf} from "@angular/common";
import {SessionService} from "../services/session.service";
import {NgbModal, NgbModalRef} from "@ng-bootstrap/ng-bootstrap";
import {User} from "../models/user.model";
import {ApiService} from "../services/api.service";

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    NavbarComponent,
    NgForOf,
    NgIf
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css'
})
export class UsersComponent implements OnInit {
  isExpanded: boolean = true;
  userData: any;
  modalRef: NgbModalRef | null = null;
  users: User[] = [];

  constructor(private shared: SharedService, public session: SessionService, private modalService: NgbModal, private api: ApiService) {
  }

  ngOnInit() {
    this.shared.sidebarExpanded$.subscribe(expanded => {
      this.isExpanded = expanded
    });

    this.api.getAllUsers().subscribe((data) => {
      this.users = data;
    })
  }

  toggleSidebar() {
    this.isExpanded = !this.isExpanded;
    this.shared.setSidebarExpanded(this.isExpanded);
  }

  openModal(template: TemplateRef<any>, user?: any) {
    this.userData = user;
    this.modalRef = this.modalService.open(template, { backdrop: 'static', keyboard: false });
  }

  closeModal() {
    if (this.modalRef) {
      this.modalRef.close();
    }
  }

  editUser(name: any, email: any, password: any){
    this.api.editUser(this.userData.email,name, email,password).subscribe((data) => {
      if(data.status == "OK"){
        this.ngOnInit()
        this.closeModal();
      }
    })
  }

  createNewUser(name: any, email: any, password: any) {
    this.api.createNewUser(name, email, password).subscribe((data) => {
      if(data.status == "OK"){
        this.ngOnInit()
        this.closeModal();
      }
    })
  }

  deleteUser(name: any){
    this.api.deleteUser(name).subscribe((data) => {
      if(data.status == "OK"){
        this.ngOnInit();
        console.log("test" + this.modalRef);
        this.closeModal();
      }
    })
  }
}
