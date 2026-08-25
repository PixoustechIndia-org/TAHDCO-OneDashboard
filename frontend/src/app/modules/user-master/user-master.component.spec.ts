import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TableModule } from 'primeng/table';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';
import { UserMasterComponent } from './user-master.component';
import { AuthService } from '../../core/services/auth.service';

describe('UserMasterComponent', () => {
  let component: UserMasterComponent;
  let fixture: ComponentFixture<UserMasterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserMasterComponent],
      imports: [FormsModule, HttpClientTestingModule, RouterTestingModule, TableModule, DropdownModule, InputTextModule, DialogModule, ToastModule, ConfirmDialogModule, TooltipModule, CheckboxModule],
      providers: [MessageService, ConfirmationService, AuthService]
    }).compileComponents();
    fixture = TestBed.createComponent(UserMasterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => { expect(component).toBeTruthy(); });
  it('should load users from auth service', () => {
    // environment.apiUrl is set, so loadUsers() fetches GET /api/v1/users; flush
    // the captured request instead of waiting on a real HTTP call.
    TestBed.inject(HttpTestingController)
      .expectOne('https://onedashboard-v1.pixoustech.app/api/v1/users')
      .flush([{ id: 1, name: 'Arjun', email: 'arjun@tahdco.in', role: 'gm', scope: 'all', appAccess: [], privileges: {}, isActive: true }]);
    expect(component.users.length).toBeGreaterThan(0);
  });
  it('should filter users by search term', () => {
    component.users = [{ id:1, name:'Arjun', email:'a@x.in', role:'gm', scope:'all', appAccess:[], isActive:true }] as any;
    component.searchTerm = 'arjun'; component.applyFilter();
    expect(component.filteredUsers.length).toBe(1);
  });
  it('should open add dialog', () => { component.openAdd(); expect(component.dialogVisible).toBeTrue(); expect(component.isEditMode).toBeFalse(); });
  it('should return correct role label', () => { expect(component.roleLabel('gm')).toBe('General Manager'); });
});
