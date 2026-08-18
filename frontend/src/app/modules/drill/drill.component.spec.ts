import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ChartModule } from 'primeng/chart';
import { DropdownModule } from 'primeng/dropdown';
import { of } from 'rxjs';
import { DrillComponent } from './drill.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { DrillConfig, DrillRow } from '../../core/models';

describe('DrillComponent', () => {
  let component: DrillComponent;
  let fixture: ComponentFixture<DrillComponent>;

  const mockRows: DrillRow[] = [
    { key: 'chennai', label: 'Chennai', value: 100, segments: [
      { label: 'Done', value: 60, color: '#1e7c4c' }, { label: 'Pending', value: 40, color: '#c0392b' }
    ], extra: { Division: 'Chennai', Total: 100 } },
    { key: 'salem', label: 'Salem', value: 80, segments: [
      { label: 'Done', value: 50, color: '#1e7c4c' }, { label: 'Pending', value: 30, color: '#c0392b' }
    ] },
  ];
  const mockConfig: DrillConfig = {
    moduleId: 'tender', moduleName: 'Tender', moduleCode: 'TIPS',
    accent: '#0a1628', accentSoft: '#e8edf5', icon: 'pi-file', valueLabel: 'Works',
    segmentLegend: [ { label: 'Done', color: '#1e7c4c' }, { label: 'Pending', color: '#c0392b' } ],
    rows: mockRows
  };

  const mockDs = { getDrillData: () => of(mockConfig) };
  const mockAuth = { hasAppAccess: () => true };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DrillComponent],
      imports: [FormsModule, RouterTestingModule, HttpClientTestingModule, InputTextModule, ChartModule, DropdownModule],
      providers: [
        { provide: DataService, useValue: mockDs },
        { provide: AuthService, useValue: mockAuth },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ moduleId: 'tender' })) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(DrillComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => { expect(component).toBeTruthy(); });

  it('should load config and select first row', () => {
    expect(component.config?.moduleCode).toBe('TIPS');
    expect(component.activeRow?.key).toBe('chennai');
    expect(component.filteredRows.length).toBe(2);
  });

  it('should select a row on click', () => {
    component.selectRow(mockRows[1]);
    expect(component.activeRow?.key).toBe('salem');
  });

  it('should compute segment percentage', () => {
    expect(component.segmentPct(mockRows[0], 60)).toBe(60);
  });

  it('should compute row total', () => {
    expect(component.rowTotal(mockRows[0])).toBe(100);
  });

  it('should filter rows by search', () => {
    component.searchTerm = 'salem';
    component.onSearch();
    expect(component.filteredRows.length).toBe(1);
    expect(component.filteredRows[0].key).toBe('salem');
  });

  it('should return extra keys', () => {
    expect(component.extraKeys(mockRows[0])).toEqual(['Division', 'Total']);
    expect(component.extraKeys(mockRows[1])).toEqual([]);
  });

  it('should format numbers', () => {
    expect(component.formatNum(500)).toBe('500');
    expect(component.formatNum(1500)).toBe('1.5K');
  });

  it('should navigate back to overview', () => {
    const router = TestBed.inject(Router);
    const spy = spyOn(router, 'navigate');
    component.back();
    expect(spy).toHaveBeenCalledWith(['/overview']);
  });
});
