import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {ReactiveFormsModule, FormControl, FormGroup, Validators} from "@angular/forms";

@Component({
  selector: 'app-change-password',
  standalone: true,
    imports: [
        ReactiveFormsModule
    ],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css'
})
export class ChangePasswordComponent implements OnInit {

  token: string | undefined;

  constructor(private route: ActivatedRoute, private router: Router) {
  }

  changePasswordForm = new FormGroup({
      password: new FormControl('', Validators.required)
  });

  ngOnInit() {
      this.route.params.subscribe(params => {
        this.token = params['token'];
      });
  }

  submitChangePasswordForm(): void {
      this.router.navigate(['/login']).then(() => {
          //Send new password to database
      })
  }

}
