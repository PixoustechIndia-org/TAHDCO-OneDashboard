import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { DrillConfig, DrillRow } from '../../core/models';

@Component({
  selector: 'app-drill',
  templateUrl: './drill.component.html',
  styleUrls: ['./drill.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrillComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  config: DrillConfig | null = null;
  loading = true;

  // Left panel — the chart rows
  activeRow: DrillRow | null = null;

  // Chart
  chartData: any = { labels: [], datasets: [] };
  chartOpts: any = {};

  // Search and Dynamic Filters
  searchTerm = '';
  filteredRows: DrillRow[] = [];

  divisionOptions: any[] = [];
  selectedDivision = '';
  hasDivisions = false;

  phaseOptions: any[] = [];
  selectedPhase = '';
  hasPhases = false;

  constructor(
    private ds: DataService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const moduleId = params.get('moduleId') || 'tender';
      if (!this.canDrill(moduleId)) { this.router.navigate(['/overview']); return; }
      this.load(moduleId);
    });
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  trackByRowKey(_i: number, row: DrillRow): string { return row.key; }
  trackByIndex(i: number): number { return i; }

  /** Module → appAccess key(s); any match grants drill access. */
  private canDrill(moduleId: string): boolean {
    const APPS: Record<string, string[]> = {
      tender: ['TIPS', 'TIME'], time: ['TIPS', 'TIME'],
      housing: ['THMS'], enrollment: ['TAMS'],
      scheme: ['Scheme'], telp: ['TELP'], oneportal: ['OnePortal'],
      tod: ['TOD'], patrol: ['Patrol360'], patrol360: ['Patrol360']
    };
    const apps = APPS[moduleId];
    return !apps || apps.some(a => this.auth.hasAppAccess(a));
  }

  load(moduleId: string): void {
    this.loading = true;
    this.ds.getDrillData(moduleId).pipe(takeUntil(this.destroy$)).subscribe(cfg => {
      this.config = cfg;
      this.selectedDivision = '';
      this.selectedPhase = '';
      this.searchTerm = '';

      // Extract unique divisions
      const divs = new Set<string>();
      cfg.rows.forEach(r => {
        const dVal = r.extra ? (r.extra['Division'] || r.extra['division']) : null;
        if (dVal) divs.add(dVal.toString());
      });
      this.divisionOptions = [{ label: 'All Divisions', value: '' }, ...Array.from(divs).sort().map(d => ({ label: d, value: d }))];
      this.hasDivisions = divs.size > 0;

      // Extract unique phases
      const phs = new Set<string>();
      cfg.rows.forEach(r => {
        const pVal = r.extra ? (r.extra['Phase'] || r.extra['phase']) : null;
        if (pVal) phs.add(pVal.toString());
      });
      this.phaseOptions = [{ label: 'All Phases', value: '' }, ...Array.from(phs).sort().map(p => ({ label: p, value: p }))];
      this.hasPhases = phs.size > 0;

      this.filteredRows = [...cfg.rows];
      this.activeRow = cfg.rows[0] || null;
      this.buildChart(cfg);
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  private buildChart(cfg: DrillConfig): void {
    const rows = this.filteredRows;
    this.chartData = {
      labels: rows.map(r => r.label),
      datasets: cfg.segmentLegend.map(seg => ({
        label: seg.label,
        data: rows.map(r => {
          const s = r.segments.find(x => x.label === seg.label);
          return s ? s.value : 0;
        }),
        backgroundColor: seg.color,
        borderRadius: 4,
        barThickness: 18,
        maxBarThickness: 24,
      }))
    };
    this.chartOpts = {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_evt: any, elements: any[]) => {
        if (elements?.length) {
          const idx = elements[0].index;
          this.selectRow(rows[idx]);
        }
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            font: { size: 11, family: "'Outfit', 'Inter', sans-serif", weight: '600' },
            boxWidth: 10,
            boxHeight: 10,
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { size: 12, family: "'Outfit', 'Inter', sans-serif", weight: '700' },
          bodyFont: { size: 11, family: "'Outfit', 'Inter', sans-serif" },
          padding: 10,
          cornerRadius: 8,
          boxPadding: 4,
          callbacks: {
            label: (context: any) => {
              const val = context.raw || 0;
              const dsLabel = context.dataset.label || '';
              return `  ${dsLabel}: ${val.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            font: { size: 10, family: "'Outfit', 'Inter', sans-serif" },
            color: '#64748b'
          }
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: {
            font: { size: 11, family: "'Outfit', 'Inter', sans-serif", weight: '600' },
            color: '#1e293b'
          }
        }
      }
    };
  }

  selectRow(row: DrillRow): void {
    this.activeRow = row;
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (!this.config) return;
    const term = this.searchTerm.toLowerCase().trim();
    
    this.filteredRows = this.config.rows.filter(r => {
      // 1. Search term match
      if (term && !r.label.toLowerCase().includes(term)) return false;
      
      // 2. Division match
      const rDiv = r.extra ? (r.extra['Division'] || r.extra['division']) : null;
      if (this.selectedDivision && rDiv !== this.selectedDivision) return false;
      
      // 3. Phase match
      const rPhase = r.extra ? (r.extra['Phase'] || r.extra['phase']) : null;
      if (this.selectedPhase && rPhase !== this.selectedPhase) return false;
      
      return true;
    });

    if (this.filteredRows.length) {
      if (!this.filteredRows.some(r => r.key === this.activeRow?.key)) {
        this.activeRow = this.filteredRows[0];
      }
    } else {
      this.activeRow = null;
    }

    this.buildChart(this.config);
    this.cdr.markForCheck();
  }

  onSearch(): void {
    this.onFilterChange();
  }

  extraKeys(row: DrillRow | null): string[] {
    return row?.extra ? Object.keys(row.extra) : [];
  }

  segmentPct(row: DrillRow, value: number): number {
    const total = row.segments.reduce((s, x) => s + x.value, 0);
    return total ? Math.round((value / total) * 100) : 0;
  }

  rowTotal(row: DrillRow): number {
    return row.segments.reduce((s, x) => s + x.value, 0);
  }

  back(): void { this.router.navigate(['/overview']); }

  goToFullModule(): void {
    const map: Record<string, string> = {
      tender: '/tender', time: '/tender', housing: '/housing',
      enrollment: '/enrollment', scheme: '/scheme-report', telp: '/scheme-report',
      oneportal: '/scheme-report', tod: '/tod', patrol: '/patrol360'
    };
    this.router.navigate([map[this.config?.moduleId || 'tender'] || '/overview']);
  }

  // View mode: '3d' | '2d' | 'table'
  viewMode: '3d' | '2d' | 'table' = '3d';

  // Add custom row modal state
  displayAddModal = false;
  newEntry = {
    label: '',
    value: 0,
    inProgress: 0,
    notStarted: 0,
    completed: 0,
    mBooks: 0
  };

  setViewMode(mode: '3d' | '2d' | 'table'): void {
    this.viewMode = mode;
    this.cdr.markForCheck();
  }

  openAddModal(): void {
    this.newEntry = {
      label: '',
      value: 100,
      inProgress: 60,
      notStarted: 15,
      completed: 25,
      mBooks: 30
    };
    this.displayAddModal = true;
    this.cdr.markForCheck();
  }

  saveNewEntry(): void {
    if (!this.newEntry.label || !this.config) return;

    const tot = Number(this.newEntry.value) || 0;
    const inProg = Number(this.newEntry.inProgress) || 0;
    const notSt = Number(this.newEntry.notStarted) || 0;
    const comp = Number(this.newEntry.completed) || 0;

    const newRow: DrillRow = {
      key: this.newEntry.label.toLowerCase().replace(/\s+/g, '-'),
      label: this.newEntry.label,
      value: tot,
      segments: [
        { label: 'In progress', value: inProg, color: '#10b981' },
        { label: 'Not started', value: notSt, color: '#ef4444' },
        { label: 'Completed', value: comp, color: '#1e3a8a' },
      ],
      extra: {
        'Total works': tot,
        'In progress': inProg,
        'Not started': notSt,
        'Completed': comp,
        'M-Books': Number(this.newEntry.mBooks) || 0
      }
    };

    this.config.rows.unshift(newRow);
    this.onFilterChange();
    this.selectRow(newRow);
    this.displayAddModal = false;
    this.cdr.markForCheck();
  }

  exportTableCSV(dtTable?: any): void {
    if (dtTable) {
      dtTable.exportCSV();
    } else {
      const rows = this.filteredRows.map(r => ({
        Division_District: r.label,
        Total_Value: r.value,
        ...r.extra
      }));
      if (!rows.length) return;
      const headers = Object.keys(rows[0]).join(',');
      const body = rows.map(r => Object.values(r).join(',')).join('\n');
      const blob = new Blob([`${headers}\n${body}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `${this.config?.moduleCode || 'Drill'}_Data.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  formatNum(n: number | string): string {
    if (typeof n === 'string') return n;
    if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }
}
