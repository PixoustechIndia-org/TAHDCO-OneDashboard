import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockDs = {
    getKpiCards: () => of([]),
    getTenderSummary: () => of({ started: 0, totalWorks: 0, inProgress: 0, slowProgress: 0, notStarted: 0, completed: 0, paymentPending: 0, mBookTotal: 0, mBookPending: 0, noAction: 0 }),
    getTenderDivisionCounts: () => of([]),
    getHousingOverall: () => of({ totalHouses: 0, completed: 0, started: 0, notStarted: 0, roofLevel: 0, gradBeam: 0, basement: 0, lintelLevel: 0 }),
    getHousingDistricts: () => of([]),
    getMonthlyCompletion: () => of([]),
    getSchemes: () => of([]),
    getEnrollSummary: () => of({ totalStudents: 0, newEnrollment: 0, female: 0, male: 0, others: 0 }),
    getEnrollDistricts: () => of([]),
    getTodSummary: () => of({ totalTasks: 0, totalEvents: 0, notStarted: 0, inProgress: 0, completed: 0, overdue: 0 }),
    getPatrolSummary: () => of({ totalWorks: 0, started: 0, notStarted: 0, inProgress: 0, completed: 0, cameraInstalled: 0, currentActive: 0, currentInactive: 0 }),
    getOfflineDuration: () => of({ lessThan2Days: 0, between3To10Days: 0, moreThan10Days: 0 }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DashboardComponent],
      imports: [FormsModule, RouterTestingModule, HttpClientTestingModule, DropdownModule, ButtonModule, ChartModule, DialogModule, ToastModule, TooltipModule],
      providers: [MessageService, { provide: DataService, useValue: mockDs }, AuthService]
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => { expect(component).toBeTruthy(); });

  it('should format numbers correctly', () => {
    expect(component.formatNum(500)).toBe('500');
    expect(component.formatNum(1500)).toBe('1.5K');
    expect(component.formatNum(150000)).toBe('1.5L');
  });

  it('should track by index', () => {
    expect(component.trackByIndex(0)).toBe(0);
  });
});
