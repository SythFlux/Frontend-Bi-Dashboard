import { Component } from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {LoginComponent} from "./login/login.component";
import {HomeComponent} from "./home/home.component";
import {NavbarComponent} from "./navbar/navbar.component";
import {NgxChartsModule} from "@swimlane/ngx-charts";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],   // Only this is needed
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'battery-site';
}
