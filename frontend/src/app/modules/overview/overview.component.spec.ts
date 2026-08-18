import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { OverviewComponent } from './overview.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ModuleTile } from '../../core/models';

describe('OverviewComponent', () => {
  let component: OverviewComponent;
  let fixture: ComponentFixture<OverviewComponent>;

  const mockTiles: ModuleTile[] = [
    { id: 'tender', code: 'TIPS', name: 'Tender', route: '/tender', app: 'TIPS', icon: 'pi-file', accent: '#000', accentSoft: '#eee', primaryValue: 288, primaryLabel: 'Works', stats: [{ label: 'x', value: 1, tone: 'ok' }] },
    { id: 'tod', code: 'TOD', name: 'Diary', route: '/tod', app: 'TOD', icon: 'pi-cal', accent: '#000', accentSoft: '#eee', primaryValue: 150, primaryLabel: 'Tasks', stats: [{ label: 'y', value: 2, tone: 'bad' }] },
  ];

  const mockDs = { getOverviewTiles: () => of(mockTiles) };
  const mockAuth = { getUser: () => ({ name: 'Test User', role: 'md' }), hasAppAccess: (_a: string) => true };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OverviewComponent],
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: DataService, useValue: mockDs },
        { provide: AuthService, useValue: mockAuth }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => { expect(component).toBeTruthy(); });

  it('should load all tiles the user can access', () => {
    expect(component.tiles.length).toBe(2);
    expect(component.visibleTiles.length).toBe(2);
  });

  it('should format numbers correctly', () => {
    expect(component.formatNum(500)).toBe('500');
    expect(component.formatNum(1500)).toBe('1.5K');
    expect(component.formatNum(150000)).toBe('1.5L');
    expect(component.formatNum('71/76')).toBe('71/76');
  });

  it('should map tone to css class', () => {
    expect(component.toneClass('ok')).toBe('tone-ok');
    expect(component.toneClass('bad')).toBe('tone-bad');
    expect(component.toneClass('unknown')).toBe('tone-neutral');
  });

  it('should navigate on tile click', () => {
    const router = TestBed.inject(Router);
    const spy = spyOn(router, 'navigate');
    component.openModule(mockTiles[0]);
    expect(spy).toHaveBeenCalledWith(['/drill', 'tender']);
  });

  it('should return a welcome message', () => {
    expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(component.welcomeMsg);
  });

  it('should return role label', () => {
    expect(component.roleLabel).toBe('Managing Director');
  });
});
