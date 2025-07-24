import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {ApiService} from "../services/api.service";
import {EncryptionService} from "../services/encryption.service";
import { RouterModule } from '@angular/router';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule ]
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  wrongPassword: boolean = false;
  hide: boolean = true;

  constructor(private apiService: ApiService, private router: Router, private encryption: EncryptionService) {}

  async ngOnInit(): Promise<void> {
    this.loginForm = new FormGroup({
      username: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required])
    });
  }

  submitLoginForm(): void {
    if (this.loginForm.valid) {
      console.log('Form submitted:', this.loginForm.value)
      this.wrongPassword = false;
      this.apiService.loginUser(this.loginForm.value.username, this.loginForm.value.password).subscribe(
        success => {
          if (success) {
            this.router.navigate(['/home']);
          } else {
            this.wrongPassword = true;
          }
        },
        error => {
          console.error('Unexpected error:', error);
          this.wrongPassword = true; // This is a safeguard, but ideally, errors should be caught in the loginUser method
        }
      );
    } else {
      this.wrongPassword = true;
    }
  }


  resetFields(index?: number): void {
    this.wrongPassword = false;
  }
}
