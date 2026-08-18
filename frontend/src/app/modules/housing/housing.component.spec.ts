import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ChartModule } from 'primeng/chart';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { HousingComponent } from './housing.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { of } from 'rxjs';

describe('HousingComponent', () => {
  let component: HousingComponent;
  let fixture: ComponentFixture<HousingComponent>;
  const mockDs = { getKpiCards:()=>of([]), getTenderDivisionCounts:()=>of([]), getHousingDistricts:()=>of([]), getHousingOverall:()=>of({}), getTenderSummary:()=>of({}), getSchemes:()=>of([]), getEnrollSummary:()=>of({}), getEnrollDistricts:()=>of([]), getMonthlyCompletion:()=>of([]), getTodSummary:()=>of({}), getTodDistricts:()=>of([]), getPatrolSummary:()=>of({}), getPatrolDistricts:()=>of([]), getOfflineDuration:()=>of({}), getTenderWorks:()=>of([]), getHousingMilestones:()=>of({}), getHousingStatusSummary:()=>of({}), getHousingInfrastructure:()=>of({}), getHousingLastMonth:()=>of({}), getHousingDivisionSummary:()=>of([]), getHousingDistrictNames:()=>of([]), getHousingRows:()=>of([]) };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HousingComponent],
      imports: [FormsModule,HttpClientTestingModule,RouterTestingModule,DropdownModule,InputTextModule,ButtonModule,TableModule,DialogModule,ToastModule,ChartModule,TooltipModule],
      providers: [MessageService, { provide: DataService, useValue: mockDs }, AuthService]
    }).compileComponents();
    fixture = TestBed.createComponent(HousingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => { expect(component).toBeTruthy(); });
  it('should default to table view', () => { expect(component.viewMode).toBe('table'); });
  it('should switch to chart view', () => { component.viewMode = 'chart'; expect(component.viewMode).toBe('chart'); });
  it('should open dialog with row data', () => {
    const row = { division: 'Chennai', district: 'Kanchipuram', phase: 'Phase 1', value: 100 };
    component.openRowDetail(row);
    expect(component.dialogVisible).toBeTrue();
    expect(component.activeRow).toEqual(row);
    expect(component.dialogTitle).toBe('Kanchipuram · Phase 1 · Chennai');
  });
  it('should close dialog', () => {
    component.dialogVisible = true;
    component.closeDialog();
    expect(component.dialogVisible).toBeFalse();
    expect(component.activeRow).toBeNull();
  });
  it('should default to FY 2025-26', () => { expect(component.selectedFY).toBe('FY 2025-26'); });
});
