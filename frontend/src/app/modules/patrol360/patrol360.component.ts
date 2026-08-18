import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { PALETTE, DIVISIONS, FINANCIAL_YEARS } from '../../core/models';

@Component({
  selector: 'app-patrol360',
  templateUrl: './patrol360.component.html',
  styleUrls: ['./patrol360.component.scss'],
  providers: [MessageService]
})
export class Patrol360Component implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  fyOptions = FINANCIAL_YEARS.map(y => ({ label: y, value: y }));
  divOptions = DIVISIONS.map(d => ({ label: d, value: d }));
  selectedFY = 'FY 2025-26';
  selectedDiv = 'All Divisions';
  searchTerm = '';

  private allRows: any[] = [];
  tableData: any[] = [];
  summary: any = {};
  offline: any = {};
  kpis: any[] = [];
  loading = true;
  first = 0; rows = 15;
  viewMode: 'table' | 'chart' = 'table';

  dialogVisible = false;
  dialogTitle = '';
  activeRow: any = null;
  dialogChartData: any = {};
  dialogChartOpts: any = {
    responsive: true, maintainAspectRatio: false, cutout: '68%',
    plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 8, padding: 8 } } }
  };

  chartData: any = {};
  chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { font: { size: 10 }, boxWidth: 10, padding: 12 } },
               tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { stacked: true, grid: { color: '#f2f2f8' }, ticks: { font: { size: 10 } }, beginAtZero: true }
    }
  };

  get user() { return this.auth.getUser(); }
  constructor(public auth: AuthService, private ds: DataService, private msg: MessageService) {}

  ngOnInit(): void {
    this.fetchLiveData();
    this.ds.getOfflineDuration().pipe(takeUntil(this.destroy$)).subscribe(o => this.offline = o || {});
  }

  fetchLiveData(): void {
    const yearVal = this.selectedFY.includes('2025-26') ? '2026' : '2025';
    this.loading = true;
    this.ds.getPatrolCameraStatus([], [], '', [], [yearVal], '', '').subscribe({
      next: (res) => {
        if (res && res.status === 'SUCCESS' && Array.isArray(res.data)) {
          const liveRows = res.data.map((item: any) => {
            return {
              district: item.districtName,
              division: item.divisionName || 'Chennai',
              totalWorks: parseInt(item.cameraInstalled || '0', 10),
              cameraInstalled: parseInt(item.cameraInstalled || '0', 10),
              currentActive: parseInt(item.cameraActive || '0', 10),
              currentInactive: parseInt(item.cameraInActive || '0', 10),
              completed: item.completed || 0,
              inProgress: item.inProgress || 0
            };
          });

          this.allRows = liveRows;
          
          const sumInstalled = liveRows.reduce((acc: number, r: any) => acc + r.cameraInstalled, 0);
          const sumActive = liveRows.reduce((acc: number, r: any) => acc + r.currentActive, 0);
          const sumInactive = liveRows.reduce((acc: number, r: any) => acc + r.currentInactive, 0);
          const sumCompleted = liveRows.reduce((acc: number, r: any) => acc + r.completed, 0);
          const sumInProgress = liveRows.reduce((acc: number, r: any) => acc + r.inProgress, 0);
          
          const uptime = sumInstalled ? Math.round((sumActive / sumInstalled) * 100) : 0;
          
          this.summary = {
            totalWorks: sumInstalled,
            cameraInstalled: sumInstalled,
            currentActive: sumActive,
            currentInactive: sumInactive,
            completed: sumCompleted,
            inProgress: sumInProgress
          };

          this.kpis = [
            { label: 'Total works',      value: this.summary.totalWorks,      icon: 'pi-video',        accent: PALETTE.navy,    soft: PALETTE.navySoft },
            { label: 'Cameras installed',value: this.summary.cameraInstalled, icon: 'pi-camera',       accent: PALETTE.info,    soft: PALETTE.infoSoft },
            { label: 'Active now',       value: this.summary.currentActive,   icon: 'pi-check-circle', accent: PALETTE.success, soft: PALETTE.successSoft },
            { label: 'Inactive',         value: this.summary.currentInactive, icon: 'pi-times-circle', accent: PALETTE.danger,  soft: PALETTE.dangerSoft },
            { label: 'Completed works',  value: this.summary.completed,       icon: 'pi-verified',     accent: PALETTE.warning, soft: PALETTE.warningSoft },
            { label: 'Camera uptime',    value: uptime,            icon: 'pi-percentage',   accent: PALETTE.gold,    soft: PALETTE.goldSoft, suffix: '%' },
          ];

          this.buildChart();
          this.load();
        } else {
          this.fallbackOffline();
        }
      },
      error: () => {
        this.fallbackOffline();
      }
    });
  }

  private fallbackOffline(): void {
    this.ds.getPatrolSummary().pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.summary = s;
      const uptime = s.cameraInstalled ? Math.round((s.currentActive / s.cameraInstalled) * 100) : 0;
      this.kpis = [
        { label: 'Total works',      value: s.totalWorks,      icon: 'pi-video',        accent: PALETTE.navy,    soft: PALETTE.navySoft },
        { label: 'Cameras installed',value: s.cameraInstalled, icon: 'pi-camera',       accent: PALETTE.info,    soft: PALETTE.infoSoft },
        { label: 'Active now',       value: s.currentActive,   icon: 'pi-check-circle', accent: PALETTE.success, soft: PALETTE.successSoft },
        { label: 'Inactive',         value: s.currentInactive, icon: 'pi-times-circle', accent: PALETTE.danger,  soft: PALETTE.dangerSoft },
        { label: 'Completed works',  value: s.completed,       icon: 'pi-verified',     accent: PALETTE.warning, soft: PALETTE.warningSoft },
        { label: 'Camera uptime',    value: uptime,            icon: 'pi-percentage',   accent: PALETTE.gold,    soft: PALETTE.goldSoft, suffix: '%' },
      ];
    });
    this.ds.getPatrolDistricts().pipe(takeUntil(this.destroy$)).subscribe(rows => {
      this.allRows = rows || [];
      this.buildChart();
      this.load();
    });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private buildChart(): void {
    const byDiv: Record<string, any> = {};
    for (const r of this.allRows) {
      const d = byDiv[r.division] || (byDiv[r.division] = { active: 0, inactive: 0 });
      d.active += r.currentActive || 0; d.inactive += r.currentInactive || 0;
    }
    const labels = Object.keys(byDiv);
    this.chartData = {
      labels,
      datasets: [
        { label: 'Active',   data: labels.map(l => byDiv[l].active),   backgroundColor: PALETTE.success, borderRadius: 4, barThickness: 18 },
        { label: 'Inactive', data: labels.map(l => byDiv[l].inactive), backgroundColor: PALETTE.danger,  borderRadius: 4, barThickness: 18 },
      ]
    };
  }

  load(): void {
    this.loading = true;
    let rows = this.allRows;
    if (this.selectedDiv && this.selectedDiv !== 'All Divisions') rows = rows.filter(r => r.division === this.selectedDiv);
    const q = this.searchTerm.trim().toLowerCase();
    if (q) rows = rows.filter(r => (r.district || '').toLowerCase().includes(q) || (r.division || '').toLowerCase().includes(q));
    this.tableData = rows;
    this.loading = false;
  }

  uptimePct(r: any): number {
    return r.cameraInstalled ? Math.round((r.currentActive / r.cameraInstalled) * 100) : 0;
  }
  barColor(p: number): string {
    if (p >= 90) return PALETTE.success;
    if (p >= 75) return PALETTE.info;
    if (p >= 50) return PALETTE.warning;
    return PALETTE.danger;
  }
  uptimePill(r: any): { text: string; cls: string } {
    if (r.currentInactive === 0) return { text: 'All online', cls: 'pill-ok' };
    const p = this.uptimePct(r);
    if (p >= 75) return { text: r.currentInactive + ' offline', cls: 'pill-warn' };
    return { text: r.currentInactive + ' offline', cls: 'pill-bad' };
  }

  openRowDetail(row: any): void {
    this.activeRow = row;
    this.dialogTitle = row.district + ' · ' + row.division;
    this.dialogChartData = {
      labels: ['Active', 'Inactive'],
      datasets: [{ data: [row.currentActive, row.currentInactive], backgroundColor: [PALETTE.success, PALETTE.danger], borderWidth: 0 }]
    };
    this.dialogVisible = true;
  }
  closeDialog(): void { this.dialogVisible = false; this.activeRow = null; }

  onSearch(): void { this.first = 0; this.load(); }
  onFilterChange(): void { this.first = 0; this.fetchLiveData(); }
  export(): void { this.msg.add({ severity: 'info', summary: 'Export', detail: 'Generating Patrol360 report…' }); }
  objectKeys(obj: any): string[] { return obj ? Object.keys(obj) : []; }
}
