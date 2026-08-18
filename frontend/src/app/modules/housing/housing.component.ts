import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { PALETTE, DIVISIONS, FINANCIAL_YEARS } from '../../core/models';

@Component({
  selector: 'app-housing',
  templateUrl: './housing.component.html',
  styleUrls: ['./housing.component.scss'],
  providers: [MessageService]
})
export class HousingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ── filters ────────────────────────────────────────────────────────────────
  fyOptions = FINANCIAL_YEARS.map(y => ({ label: y, value: y }));
  divOptions = DIVISIONS.map(d => ({ label: d, value: d }));
  distOptions: { label: string; value: string }[] = [{ label: 'All Districts', value: 'All Districts' }];
  // phases as they appear in the THMS API (no space: 'Phase1')
  phaseOptions = ['All Phases', 'Phase1', 'Phase2', 'Phase3', 'Phase4'].map(p => ({ label: p, value: p }));
  selectedFY = 'FY 2025-26';
  selectedDiv = 'All Divisions';
  selectedDistrict = 'All Districts';
  selectedPhase = 'All Phases';
  searchTerm = '';
  districtLocked = false;            // DM (district-scope) users are pinned to their district

  tableData: any[] = [];
  summary: any = {};
  kpis: any[] = [];
  loading = true;
  first = 0; rows = 15;
  viewMode: 'table' | 'chart' = 'table';

  // ── dialog ─────────────────────────────────────────────────────────────────
  dialogVisible = false;
  dialogTitle = '';
  activeRow: any = null;
  dialogChartData: any = {};
  dialogChartOpts: any = {
    responsive: true, maintainAspectRatio: false, cutout: '68%',
    plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 8, padding: 8 } } }
  };

  // ── charts (analytics view) ────────────────────────────────────────────────
  divisionChart: any = {};
  districtChart: any = {};
  milestoneChart: any = {};
  statusChart: any = {};
  infraChart: any = {};
  lastMonth: any = {};

  stackedOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { font: { size: 10 }, boxWidth: 10, padding: 10 } },
               tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { stacked: true, grid: { color: '#f2f2f8' }, ticks: { font: { size: 10 } }, beginAtZero: true }
    }
  };
  hBarOpts: any = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { font: { size: 10 }, boxWidth: 10, padding: 10 } } },
    scales: {
      x: { stacked: true, grid: { color: '#f2f2f8' }, ticks: { font: { size: 10 } }, beginAtZero: true },
      y: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } }
    }
  };
  infraOpts: any = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#f2f2f8' }, ticks: { font: { size: 10 } }, beginAtZero: true },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } }
    }
  };
  pieOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 8, padding: 8 } } }
  };
  doughnutOpts: any = { ...this.pieOpts, cutout: '68%' };

  get user() { return this.auth.getUser(); }
  constructor(public auth: AuthService, private ds: DataService, private msg: MessageService) {}

  ngOnInit(): void {
    // DM login: pin the district filter to the officer's own district
    const u: any = this.auth.getUser();
    if (u?.scope === 'district' && u?.districtName) {
      this.selectedDistrict = u.districtName;
      this.districtLocked = true;
    }

    this.ds.getHousingOverall().pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.summary = s;
      const rate = s.totalHouses ? Math.round((s.completed / s.totalHouses) * 100) : 0;
      this.kpis = [
        { label: 'Total houses',    value: s.totalHouses, icon: 'pi-home',         accent: PALETTE.navy,    soft: PALETTE.navySoft },
        { label: 'Completed',       value: s.completed,   icon: 'pi-check-circle', accent: PALETTE.success, soft: PALETTE.successSoft },
        { label: 'In progress',     value: s.started,     icon: 'pi-spin pi-cog',  accent: PALETTE.info,    soft: PALETTE.infoSoft },
        { label: 'Not started',     value: s.notStarted,  icon: 'pi-ban',          accent: PALETTE.danger,  soft: PALETTE.dangerSoft },
        { label: 'Reached roof',    value: s.roofLevel,   icon: 'pi-building',     accent: PALETTE.warning, soft: PALETTE.warningSoft },
        { label: 'Completion rate', value: rate,          icon: 'pi-percentage',   accent: PALETTE.gold,    soft: PALETTE.goldSoft, suffix: '%' },
      ];
    });
    this.ds.getHousingMilestones().pipe(takeUntil(this.destroy$)).subscribe(m => {
      this.milestoneChart = {
        labels: ['Grade beam', 'Basement', 'Lintel level', 'Roof level', 'Completion'],
        datasets: [{
          data: [m.gradeBeam, m.basement, m.lintelLevel, m.roofLevel, m.completion],
          backgroundColor: ['#7c4dbe', '#d94f6e', '#22c2dd', '#2f6fd0', PALETTE.success], borderWidth: 0
        }]
      };
    });
    this.ds.getHousingStatusSummary().pipe(takeUntil(this.destroy$)).subscribe(st => {
      this.statusChart = {
        labels: ['Completed', 'In progress', 'Not started'],
        datasets: [{
          data: [st.completed, st.inProgress, st.notStarted],
          backgroundColor: [PALETTE.success, PALETTE.info, PALETTE.danger], borderWidth: 0
        }]
      };
    });
    this.ds.getHousingInfrastructure().pipe(takeUntil(this.destroy$)).subscribe(inf => {
      this.infraChart = {
        labels: ['Hill area', 'Others area', 'Plain area'],
        datasets: [{
          data: [inf.hillArea, inf.othersArea, inf.plainArea],
          backgroundColor: ['#1e6b63', '#8a7418', PALETTE.success], borderRadius: 14, barThickness: 26
        }]
      };
    });
    this.ds.getHousingLastMonth().pipe(takeUntil(this.destroy$)).subscribe(lm => this.lastMonth = lm);

    this.loadDistricts();
    this.load();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadDistricts(): void {
    this.ds.getHousingDistrictNames(this.selectedDiv).pipe(takeUntil(this.destroy$)).subscribe(names => {
      this.distOptions = [{ label: 'All Districts', value: 'All Districts' },
                          ...names.map(n => ({ label: n, value: n }))];
      if (!this.districtLocked &&
          this.selectedDistrict !== 'All Districts' &&
          !names.includes(this.selectedDistrict)) {
        this.selectedDistrict = 'All Districts';
      }
    });
  }

  load(): void {
    this.loading = true;
    this.ds.getHousingRows(this.selectedDiv, this.selectedDistrict, this.selectedPhase, this.searchTerm)
      .pipe(takeUntil(this.destroy$))
      .subscribe(rows => {
        this.tableData = rows;
        this.buildFilteredCharts(rows);
        this.loading = false;
      });
  }

  /** Division + district charts reflect the current filter selection. */
  private buildFilteredCharts(rows: any[]): void {
    const agg = (key: string) => {
      const m: Record<string, any> = {};
      for (const r of rows) {
        const g = m[r[key]] || (m[r[key]] = { completed: 0, started: 0, notStarted: 0 });
        g.completed += r.completed; g.started += r.started; g.notStarted += r.notStarted;
      }
      return m;
    };
    const dsets = (m: Record<string, any>, labels: string[]) => ([
      { label: 'Completed',   data: labels.map(l => m[l].completed),  backgroundColor: PALETTE.success, borderRadius: 4, barThickness: 16 },
      { label: 'In progress', data: labels.map(l => m[l].started),    backgroundColor: PALETTE.info,    borderRadius: 4, barThickness: 16 },
      { label: 'Not started', data: labels.map(l => m[l].notStarted), backgroundColor: PALETTE.danger,  borderRadius: 4, barThickness: 16 },
    ]);
    const byDiv = agg('division');
    const divLabels = Object.keys(byDiv);
    this.divisionChart = { labels: divLabels, datasets: dsets(byDiv, divLabels) };

    const byDist = agg('district');
    const distLabels = Object.keys(byDist)
      .sort((a, b) => (byDist[b].completed + byDist[b].started + byDist[b].notStarted)
                    - (byDist[a].completed + byDist[a].started + byDist[a].notStarted));
    this.districtChart = { labels: distLabels, datasets: dsets(byDist, distLabels) };
  }

  completionPct(r: any): number {
    return r.totalHouses ? Math.round((r.completed / r.totalHouses) * 100) : 0;
  }
  barColor(p: number): string {
    if (p >= 90) return PALETTE.success;
    if (p >= 60) return PALETTE.info;
    if (p >= 30) return PALETTE.warning;
    return PALETTE.danger;
  }
  statusPill(r: any): { text: string; cls: string } {
    if (r.completed === r.totalHouses && r.totalHouses > 0) return { text: 'Completed', cls: 'pill-ok' };
    if (r.notStarted === r.totalHouses) return { text: 'Not started', cls: 'pill-bad' };
    if (r.started > 0) return { text: 'In progress', cls: 'pill-info' };
    return { text: 'Partial', cls: 'pill-warn' };
  }

  get districtChartHeight(): string {
    const h = Math.max(220, (this.districtChart?.labels?.length || 0) * 35 + 60);
    return `${h}px`;
  }

  downloadChart(id: string): void {
    const canvas = document.getElementById(id)?.querySelector('canvas');
    if (canvas) {
      const url = (canvas as HTMLCanvasElement).toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${id}.png`;
      a.click();
    }
  }

  printChart(id: string): void {
    const canvas = document.getElementById(id)?.querySelector('canvas');
    if (canvas) {
      const url = (canvas as HTMLCanvasElement).toDataURL('image/png');
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<img src="${url}" style="width:100%; max-width:800px; display:block; margin:50px auto;" onload="window.print(); window.close();" />`);
        win.document.close();
      }
    }
  }

  openRowDetail(row: any): void {
    this.activeRow = row;
    this.dialogTitle = `${row.district} · ${row.phase} · ${row.division}`;
    this.dialogChartData = {
      labels: ['Grade beam', 'Basement', 'Lintel', 'Roof', 'Completed'],
      datasets: [{
        data: [row.gradBeam, row.basement, row.lintelLevel, row.roofLevel, row.completed],
        backgroundColor: [PALETTE.navy, PALETTE.info, PALETTE.warning, PALETTE.gold, PALETTE.success], borderWidth: 0
      }]
    };
    this.dialogVisible = true;
  }
  closeDialog(): void { this.dialogVisible = false; this.activeRow = null; }

  onDivisionChange(): void { this.first = 0; this.loadDistricts(); this.load(); }
  onFilterChange(): void { this.first = 0; this.load(); }
  onSearch(): void { this.first = 0; this.load(); }
  export(): void { this.msg.add({ severity: 'info', summary: 'Export', detail: 'Generating THMS report…' }); }
  objectKeys(obj: any): string[] { return obj ? Object.keys(obj) : []; }
}
