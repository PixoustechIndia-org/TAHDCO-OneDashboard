import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { AuditLogComponent } from './audit-log.component';
import { AuthService } from '../../core/services/auth.service';

describe('AuditLogComponent', () => {
  let component: AuditLogComponent;
  let fixture: ComponentFixture<AuditLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AuditLogComponent ],
      imports: [ 
        HttpClientTestingModule, 
        RouterTestingModule, 
        FormsModule,
        DropdownModule,
        TableModule,
        ToastModule
      ],
      providers: [ AuthService ],
      schemas: [ NO_ERRORS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuditLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create AuditLogComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should load mock audit log entries on init', () => {
    expect(component.auditLogs.length).toBeGreaterThan(0);
    expect(component.filteredLogs.length).toBeGreaterThan(0);
  });

  it('should filter audit logs by action category correctly', () => {
    component.selectedAction = 'Scheduler';
    component.applyFilters();
    expect(component.filteredLogs.every(l => l.category === 'Scheduler')).toBeTrue();
  });
});
