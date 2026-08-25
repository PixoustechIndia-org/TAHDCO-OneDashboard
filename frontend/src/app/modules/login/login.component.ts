import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';

interface DemoRole {
  short: string; title: string; scope: string; email: string; icon: string; cls: string;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  providers: [MessageService]
})
export class LoginComponent implements AfterViewInit {
  @ViewChild('bgVideo') bgVideo!: ElementRef<HTMLVideoElement>;
  form: FormGroup;
  loading = false;
  showPwd = false;
  private returnUrl = '/overview';
  
  demoRoles: DemoRole[] = [
    { short: 'Admin', title: 'System Administrator', scope: 'HQ Level', email: 'admin@tahdco.in', icon: 'pi pi-shield', cls: 'r-sec' },
    { short: 'MD', title: 'Managing Director', scope: 'HQ Level', email: 'md@tahdco.in', icon: 'pi pi-star-fill', cls: 'r-md' },
    { short: 'GM', title: 'General Manager', scope: 'HQ Level', email: 'gm@tahdco.in', icon: 'pi pi-briefcase', cls: 'r-gm' },
    { short: 'EE', title: 'Executive Engineer', scope: 'Division Level', email: 'ee@tahdco.in', icon: 'pi pi-compass', cls: 'r-ee' }
  ];

  fillRole(role: DemoRole): void {
    this.form.patchValue({ email: role.email, password: 'Password123!' });
    this.form.markAsUntouched();
  }

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private ds: DataService,
    private router: Router,
    private route: ActivatedRoute,
    private msg: MessageService
  ) {
    if (this.auth.isLoggedIn()) this.router.navigate(['/overview']);
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/overview';
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  get f() { return this.form.controls; }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.auth.login(this.form.value).subscribe({
      next: () => {
        // Trigger a fresh data load now that we have a valid JWT
        this.ds.refresh();
        this.loading = false;
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (e) => {
        this.loading = false;
        const errMsg = (e.error?.message || e.error?.detail || '').toLowerCase();
        const isInactive = errMsg.includes('inactive') || e.error?.status === 'ACCOUNT_INACTIVE' || e.error?.errorCode === 'ACCOUNT_INACTIVE' || e.status === 403;

        if (isInactive) {
          this.msg.add({
            severity: 'warn',
            summary: 'Account Inactive',
            detail: 'Your account is currently inactive. Please contact the TAHDCO administrator to activate your account.',
            life: 5000
          });
        } else {
          this.msg.add({
            severity: 'error',
            summary: 'Sign In Failed',
            detail: 'Invalid email or password. Please check your credentials and try again.',
            life: 4000
          });
        }
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.bgVideo && this.bgVideo.nativeElement) {
      this.bgVideo.nativeElement.muted = true;
      this.bgVideo.nativeElement.volume = 0;
    }
  }
}
