import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardMdComponent } from './dashboard-md.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('DashboardMdComponent', () => {
  let component: DashboardMdComponent;
  let fixture: ComponentFixture<DashboardMdComponent>;

  const mockDs = {
    globalFilters$: of(), // never emits -> no filter-change side effects during tests
    getRawDataForYear: jasmine.createSpy('getRawDataForYear').and.returnValue(of([])),
    getOneDashboardWorkList: jasmine.createSpy('getOneDashboardWorkList').and.returnValue(of({ status: 'SUCCESS', data: [] })),
    getThmsBenList: jasmine.createSpy('getThmsBenList').and.returnValue(of({ status: 'SUCCESS', data: [] })),
    getTelpApplicationDetail: jasmine.createSpy('getTelpApplicationDetail').and.returnValue(of({ status: 'SUCCESS', data: [] })),
    getTncwwbGeneral: jasmine.createSpy('getTncwwbGeneral').and.returnValue(of({ status: 'SUCCESS', data: [] })),
    getUnifiedDashboardCounts: jasmine.createSpy('getUnifiedDashboardCounts').and.returnValue(of({})),
    getPatrolCameraStatus: jasmine.createSpy('getPatrolCameraStatus').and.returnValue(of({ status: 'SUCCESS', data: [] }))
  };

  const mockAuth = {
    getUser: () => ({ name: 'Test MD' })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DashboardMdComponent],
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        MessageService,
        { provide: DataService, useValue: mockDs },
        { provide: AuthService, useValue: mockAuth }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DashboardMdComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to eng tab', () => {
    expect(component.activeTab).toBe('eng');
  });

  it('should correctly format payload for TIPS status', () => {
    const dummyRow = { district: 'Chennai', division: 'Chennai', col1: 10, col2: 5, col3: 5 };
    component.openDetailList('tips', dummyRow, 'In-progress');
    expect(mockDs.getOneDashboardWorkList).toHaveBeenCalledWith('work', ['Chennai'], ['In-progress'], ['2026'], '', 'Chennai');
  });

  it('should correctly format payload for TIME status', () => {
    const dummyRow = { district: 'Chennai', division: 'Chennai', col4: 10, col5: 5, col6: 5 };
    component.openDetailList('time', dummyRow, 'Saved as Mbooknotuploaded');
    expect(mockDs.getOneDashboardWorkList).toHaveBeenCalledWith('mbook', ['Chennai'], ['submitted'], ['2026'], '', 'Chennai');
  });

  it('should correctly format payload for PATROL status', () => {
    const dummyRow = { district: 'Chennai', division: 'Chennai', col1: 10, col2: 5 };
    component.openDetailList('patrol', dummyRow, 'Live');
    expect(mockDs.getOneDashboardWorkList).toHaveBeenCalledWith('work', ['Chennai'], [], ['2026', '2025', '2024', '2023'], 'Live', 'Chennai');
  });

  it('should correctly format payload for THMS status', () => {
    const dummyRow = { district: 'Chennai', division: 'Chennai', col1: 10, col3: 5 };
    component.openDetailList('thms', dummyRow, 'Not Started');
    expect(mockDs.getThmsBenList).toHaveBeenCalledWith('Chennai', 'Not Started', '');
  });
});
