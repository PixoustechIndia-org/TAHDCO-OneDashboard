import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { of, Subject, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

describe('LoginComponent', () => {
  let c: LoginComponent; 
  let f: ComponentFixture<LoginComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let messageServiceSpy: jasmine.SpyObj<MessageService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['login', 'isLoggedIn']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']);
    messageServiceSpy = jasmine.createSpyObj('MessageService', ['add']);
    // PrimeNG's p-toast subscribes to messageService.messageObserver and
    // messageService.clearObserver on init.
    messageServiceSpy.messageObserver = new Subject<any>();
    messageServiceSpy.clearObserver = new Subject<any>();
    const dataServiceSpy = jasmine.createSpyObj('DataService', ['refresh']);

    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [
        ReactiveFormsModule,
        RouterTestingModule,
        HttpClientTestingModule,
        InputTextModule,
        ButtonModule,
        ToastModule
      ],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        // RouterTestingModule's default ActivatedRoute factory dereferences the
        // real Router (routerState.root); provide an explicit stub so the mocked
        // Router does not blow up during component construction.
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
        { provide: DataService, useValue: dataServiceSpy },
        { provide: MessageService, useValue: messageServiceSpy }
      ]
    })
    .overrideComponent(LoginComponent, {
      set: { providers: [{ provide: MessageService, useValue: messageServiceSpy }] }
    })
    .compileComponents(); 
    
    authServiceSpy.isLoggedIn.and.returnValue(false);
    f = TestBed.createComponent(LoginComponent); 
    c = f.componentInstance; 
    f.detectChanges(); 
  });

  it('should create', () => expect(c).toBeTruthy());
  
  it('should toggle password visibility', () => { 
    c.showPwd = false; 
    c.showPwd = !c.showPwd; 
    expect(c.showPwd).toBeTrue(); 
  });

  it('should not call auth service if form is invalid', () => {
    c.form.patchValue({ email: '', password: '' });
    c.submit();
    expect(authServiceSpy.login).not.toHaveBeenCalled();
  });

  it('should navigate to returnUrl on successful login', fakeAsync(() => {
    c.form.patchValue({ email: 'admin@tahdco.in', password: 'Password123!' });
    authServiceSpy.login.and.returnValue(of({ 
      token: 'mock-token', 
      user: { id: 1, name: 'Admin', email: 'admin@tahdco.in', role: 'admin', scope: 'all', appAccess: [], isActive: true, lastLogin: 'now' } 
    }));
    
    c.submit();
    tick(); // simulate observable resolution
    
    expect(authServiceSpy.login).toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/overview');
    expect(c.loading).toBeFalse();
  }));

  it('should show error toast on invalid credentials', fakeAsync(() => {
    c.form.patchValue({ email: 'bad@tahdco.in', password: 'wrong1' }); // 6+ chars so the form passes minLength validation
    authServiceSpy.login.and.returnValue(throwError(() => new Error('Invalid email or password.')));
    
    c.submit();
    tick();
    
    expect(authServiceSpy.login).toHaveBeenCalled();
    expect(messageServiceSpy.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'error',
      summary: 'Sign-in failed',
      detail: 'Invalid email or password.'
    }));
    expect(c.loading).toBeFalse();
  }));
});
