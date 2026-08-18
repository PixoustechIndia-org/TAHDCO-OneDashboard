import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import {
  DASHBOARD_MODULES, DashboardModuleConfig, DashboardModuleKey,
  ClickContext, DashboardCacheResult, NormalizedCount, NormalizedDetailRecord,
  CacheStatusKind
} from '../../core/models';

/**
 * Multi-Module Dashboard — the click-driven COUNT/DETAIL screen backed by
 * api/v2/dashboard-cache/*. One module tab at a time; every count row is clickable and
 * expands an inline DETAIL panel (mirrors the expand-in-place pattern already used in
 * dashboard-md.component.ts) with its own DataStatus badge + manual Refresh.
 *
 * Grounding contract this component must not violate:
 *  - never show a count/detail row without also showing its `source`/`stale` status
 *  - a STALE or unavailable result must say so on screen, never look identical to fresh data
 *  - failure never clears a previously-shown table — it swaps only the status badge/banner
 */
@Component({
  selector: 'app-multi-dashboard',
  templateUrl: './multi-dashboard.component.html',
  styleUrls: ['./multi-dashboard.component.scss']
})
export class MultiDashboardComponent implements OnInit {
  allModules: DashboardModuleConfig[] = DASHBOARD_MODULES;
  visibleModules: DashboardModuleConfig[] = [];
  selected: DashboardModuleConfig = DASHBOARD_MODULES[0];

  filters = { district: '', division: '', year: new Date().getFullYear().toString() };

  countLoading = false;
  countResult: DashboardCacheResult<NormalizedCount[]> | null = null;

  expandedRowKey: string | null = null;
  detailLoading = false;
  detailResult: DashboardCacheResult<NormalizedDetailRecord[]> | null = null;
  detailColumns: string[] = [];
  activeClickContext: ClickContext | null = null;

  constructor(private ds: DataService, private auth: AuthService) {}

  ngOnInit(): void {
    this.visibleModules = this.allModules.filter(m => this.auth.hasAppAccess(m.app));
    if (this.visibleModules.length === 0) this.visibleModules = this.allModules; // admin/no appAccess set -> show all rather than a blank page
    this.selected = this.visibleModules[0];
    this.loadCounts();
  }

  selectModule(mod: DashboardModuleConfig): void {
    if (mod.key === this.selected.key) return;
    this.selected = mod;
    this.expandedRowKey = null;
    this.detailResult = null;
    this.loadCounts();
  }

  private activeFilters(): Record<string, any> {
    const f: Record<string, any> = {};
    if (this.filters.district) f['district'] = this.filters.district;
    if (this.filters.division) f['division'] = this.filters.division;
    if (this.filters.year) f['year'] = this.filters.year;
    return f;
  }

  loadCounts(): void {
    this.countLoading = true;
    this.expandedRowKey = null;
    this.ds.getModuleCount(this.selected.key, this.activeFilters()).subscribe(res => {
      this.countResult = res;
      this.countLoading = false;
    });
  }

  rowKey(row: NormalizedCount): string {
    return `${row.module}|${row.district ?? '-'}|${row.division ?? '-'}|${row.metric}`;
  }

  /** A count row was clicked — build the full ClickContext (never the bare count value) and
   * either collapse the panel if it's already open for this row, or fetch its DETAIL. */
  toggleRowDetail(row: NormalizedCount): void {
    const key = this.rowKey(row);
    if (this.expandedRowKey === key) {
      this.expandedRowKey = null;
      return;
    }
    this.expandedRowKey = key;
    const clickContext: ClickContext = {
      module: this.selected.key,
      district: row.district,
      division: row.division,
      metric: row.metric,
      count: row.value,
      filters: this.activeFilters()
    };
    this.activeClickContext = clickContext;
    this.loadDetail(clickContext);
  }

  private loadDetail(clickContext: ClickContext): void {
    this.detailLoading = true;
    this.detailResult = null;
    this.ds.getModuleDetail(clickContext.module, clickContext).subscribe(res => {
      this.detailResult = res;
      this.detailColumns = this.computeDetailColumns(res.data ?? []);
      this.detailLoading = false;
    });
  }

  refreshActiveDetail(): void {
    if (!this.activeClickContext) return;
    this.detailLoading = true;
    this.ds.refreshModuleDetail(this.activeClickContext.module, this.activeClickContext).subscribe(() => {
      // Refresh is fire-and-forget on the server (single-flighted background fetch); re-read
      // the cache immediately after — if the live call is still in flight this will show the
      // previous (possibly still-stale) data, which is correct: never block the UI on it.
      this.loadDetail(this.activeClickContext!);
    });
  }

  refreshCounts(): void {
    this.loadCounts();
  }

  /** Union of keys across the first few records so heterogeneous per-module payload shapes
   * (TELP fields differ from One Portal fields) still render as a sane table instead of one
   * column per component instance. */
  private computeDetailColumns(records: NormalizedDetailRecord[]): string[] {
    const cols = new Set<string>();
    records.slice(0, 5).forEach(r => Object.keys(r.data || {}).forEach(k => cols.add(k)));
    return Array.from(cols).slice(0, 6); // keep the inline table readable
  }

  statusSeverity(status: CacheStatusKind | undefined): 'success' | 'warning' | 'danger' | 'secondary' {
    switch (status) {
      case 'FRESH': return 'success';
      case 'STALE': return 'warning';
      case 'API_FAILED': return 'danger';
      default: return 'secondary';
    }
  }

  fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }
}
