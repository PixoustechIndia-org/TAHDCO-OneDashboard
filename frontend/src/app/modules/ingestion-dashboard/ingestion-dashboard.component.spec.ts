import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { IngestionDashboardComponent } from './ingestion-dashboard.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DataService } from '../../core/services/data.service';

describe('IngestionDashboardComponent', () => {
  let component: IngestionDashboardComponent;
  let fixture: ComponentFixture<IngestionDashboardComponent>;
  let dataServiceMock: any;

  beforeEach(async () => {
    dataServiceMock = {
      triggerIngestionSync: jasmine.createSpy('triggerIngestionSync').and.returnValue(of({ success: true, apiStatuses: [] })),
      getIngestionStatus: jasmine.createSpy('getIngestionStatus').and.returnValue(of({ success: true, apiStatuses: [] })),
      getIngestionRecords: jasmine.createSpy('getIngestionRecords').and.returnValue(of([]))
    };

    await TestBed.configureTestingModule({
      declarations: [IngestionDashboardComponent],
      imports: [HttpClientTestingModule],
      providers: [
        MessageService,
        { provide: DataService, useValue: dataServiceMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(IngestionDashboardComponent);
    component = fixture.componentInstance;
    // Don't call fixture.detectChanges() immediately because we want to test ngOnInit logic
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should auto-trigger sync on page load', fakeAsync(() => {
    fixture.detectChanges(); // This triggers ngOnInit
    tick(); // Fast-forward time for the observable
    expect(dataServiceMock.triggerIngestionSync).toHaveBeenCalled();
    expect(component.isSyncing).toBeFalse();
  }));

  it('should map fallback records correctly if statuses are empty', fakeAsync(() => {
    dataServiceMock.triggerIngestionSync.and.returnValue(of({ success: true, apiStatuses: [] }));
    fixture.detectChanges();
    tick();
    
    // Check if fallback array is loaded correctly
    expect(component.records.length).toBeGreaterThan(0);
  }));
});
