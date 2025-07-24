import { Routes } from '@angular/router';
import { LoginComponent } from "./login/login.component";
import {NotFoundComponent} from "./not-found/not-found.component";
import {HomeComponent} from "./home/home.component";
import {NavbarComponent} from "./navbar/navbar.component";
import {SettingsComponent} from "./settings/settings.component";
import {authGuard, authGuardAdmin} from "./auth.guard";
import {MeasurementsComponent} from "./measurements/measurements.component";
import {DevicesComponent} from "./devices/devices.component";
import {ChangePasswordComponent} from "./change-password/change-password.component";
import {UsersComponent} from "./users/users.component";

export const routes: Routes = [
  { path: 'login', title: "Login",component: LoginComponent},
  { path: '404', title: "NotFound", component: NotFoundComponent },
  { path: "change-password", title: "Change Password", component: ChangePasswordComponent},
  { path: 'home', title: "Home", component: HomeComponent, canActivate: [authGuard]  },
  { path: 'nav', title: "Navbar", component: NavbarComponent, canActivate: [authGuard]  },
  { path: 'settings', title: "Settings", component: SettingsComponent, canActivate: [authGuard, authGuardAdmin]  },
  { path: 'users', title: "Users", component: UsersComponent, canActivate: [authGuard]},
  { path: 'measurements', title: "Measurements", component: MeasurementsComponent, canActivate: [authGuard] },
  { path: 'devices', title: "Devices", component: DevicesComponent, canActivate: [authGuard] },
  { path: '', redirectTo: '/login', pathMatch: "full" },
  { path: '**', redirectTo: "/404" }
];
