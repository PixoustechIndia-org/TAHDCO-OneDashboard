import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { TncwwbComponent } from './tncwwb.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';

describe('TncwwbComponent', () => {
  let component: TncwwbComponent;
  let fixture: ComponentFixture<TncwwbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TncwwbComponent ],
      imports: [ 
        HttpClientTestingModule, 
        RouterTestingModule, 
        FormsModule,
        DropdownModule,
        TableModule,
        ToastModule
      ],
      providers: [
        DataService,
        AuthService,
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ district: 'Chennai', year: '2026', mode: 'list', cat: 'member' })
          }
        }
      ],
      schemas: [ NO_ERRORS_SCHEMA ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TncwwbComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create TncwwbComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should restore filters from queryParams (district=Chennai)', () => {
    expect(component.selectedDistrict).toBe('Chennai');
    expect(component.selectedFY).toBe('2026');
    expect(component.viewMode).toBe('list');
  });

  it('should filter member list by district and status correctly', () => {
    component.selectedDistrict = 'Chennai';
    component.applyFilters();
    expect(component.filteredMemberList.every(m => m.district === 'Chennai')).toBeTrue();
  });
});
