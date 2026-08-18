import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ModuleTile, ROLE_META } from '../../core/models';

@Component({
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  tiles: ModuleTile[] = [];
  visibleTiles: ModuleTile[] = [];
  loading = true;

  get user() { return this.auth.getUser(); }

  get welcomeMsg(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  get roleLabel(): string {
    return this.user ? ROLE_META[this.user.role]?.label ?? '' : '';
  }

  get today(): string {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  constructor(
    private ds: DataService,
    public auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  trackByTileId(_i: number, tile: ModuleTile): string { return tile.id; }
  trackByStatIndex(i: number): number { return i; }

  load(): void {
    this.loading = true;
    this.ds.getOverviewTiles().pipe(takeUntil(this.destroy$)).subscribe(tiles => {
      this.tiles = tiles;
      // Gate tiles by the user's app access (leadership roles see all)
      this.visibleTiles = tiles.filter(t => !t.app || this.auth.hasAppAccess(t.app));
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  openModule(tile: ModuleTile): void {
    this.router.navigate(['/drill', tile.id]);
  }

  toneClass(tone: string): string {
    const m: Record<string, string> = { ok: 'tone-ok', warn: 'tone-warn', bad: 'tone-bad', neutral: 'tone-neutral' };
    return m[tone] || 'tone-neutral';
  }

  formatNum(n: number | string): string {
    if (typeof n === 'string') return n;
    if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }
}
