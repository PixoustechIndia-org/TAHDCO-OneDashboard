import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { PALETTE, DIVISIONS, FINANCIAL_YEARS } from '../../core/models';

@Component({
  selector: 'app-tod',
  templateUrl: './tod.component.html',
  styleUrls: ['./tod.component.scss'],
  providers: [MessageService]
})
export class TodComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  fyOptions = FINANCIAL_YEARS.map(y => ({ label: y, value: y }));
  divOptions = DIVISIONS.map(d => ({ label: d, value: d }));
  selectedFY = 'FY 2025-26';
  selectedDiv = 'All Divisions';
  searchTerm = '';

  private allRows: any[] = [];
  tableData: any[] = [];
  summary: any = {};
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
    this.ds.getTodSummary().pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.summary = s;
      const rate = s.totalTasks ? Math.round((s.completed / s.totalTasks) * 100) : 0;
      this.kpis = [
        { label: 'Total tasks',     value: s.totalTasks, icon: 'pi-check-square', accent: PALETTE.navy,    soft: PALETTE.navySoft },
        { label: 'Completed',       value: s.completed,  icon: 'pi-check-circle', accent: PALETTE.success, soft: PALETTE.successSoft },
        { label: 'In progress',     value: s.inProgress, icon: 'pi-spin pi-cog',  accent: PALETTE.info,    soft: PALETTE.infoSoft },
        { label: 'Not started',     value: s.notStarted, icon: 'pi-ban',          accent: PALETTE.warning, soft: PALETTE.warningSoft },
        { label: 'Overdue',         value: s.overdue,    icon: 'pi-exclamation-triangle', accent: PALETTE.danger, soft: PALETTE.dangerSoft },
        { label: 'Completion rate', value: rate,         icon: 'pi-percentage',   accent: PALETTE.gold,    soft: PALETTE.goldSoft, suffix: '%' },
      ];
    });
    this.ds.getTodDistricts().pipe(takeUntil(this.destroy$)).subscribe(rows => {
      this.allRows = rows || [];
      this.buildChart();
      this.load();
    });
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private buildChart(): void {
    const byDiv: Record<string, any> = {};
    for (const r of this.allRows) {
      const d = byDiv[r.division] || (byDiv[r.division] = { completed: 0, inProgress: 0, notStarted: 0, overdue: 0 });
      d.completed += r.completed || 0; d.inProgress += r.inProgress || 0;
      d.notStarted += r.notStarted || 0; d.overdue += r.overdue || 0;
    }
    const labels = Object.keys(byDiv);
    this.chartData = {
      labels,
      datasets: [
        { label: 'Completed',   data: labels.map(l => byDiv[l].completed),  backgroundColor: PALETTE.success, borderRadius: 4, barThickness: 18 },
        { label: 'In progress', data: labels.map(l => byDiv[l].inProgress), backgroundColor: PALETTE.info,    borderRadius: 4, barThickness: 18 },
        { label: 'Not started', data: labels.map(l => byDiv[l].notStarted), backgroundColor: PALETTE.warning, borderRadius: 4, barThickness: 18 },
        { label: 'Overdue',     data: labels.map(l => byDiv[l].overdue),    backgroundColor: PALETTE.danger,  borderRadius: 4, barThickness: 18 },
      ]
    };
  }

  load(): void {
    this.loading = true;
    let rows = this.allRows;
    if (this.selectedDiv && this.selectedDiv !== 'All Divisions') rows = rows.filter(r => r.division === this.selectedDiv);
    const q = this.searchTerm.trim().toLowerCase();
    if (q) rows = rows.filter(r => (r.district || '').toLowerCase().includes(q) || (r.taskType || '').toLowerCase().includes(q) || (r.division || '').toLowerCase().includes(q));
    this.tableData = rows;
    this.loading = false;
  }

  completionPct(r: any): number {
    return r.taskCount ? Math.round((r.completed / r.taskCount) * 100) : 0;
  }
  barColor(p: number): string {
    if (p >= 75) return PALETTE.success;
    if (p >= 50) return PALETTE.info;
    if (p >= 25) return PALETTE.warning;
    return PALETTE.danger;
  }
  overduePill(r: any): { text: string; cls: string } {
    if (r.overdue > 0) return { text: r.overdue + ' overdue', cls: 'pill-bad' };
    if (r.notStarted > 0) return { text: r.notStarted + ' pending', cls: 'pill-warn' };
    return { text: 'On track', cls: 'pill-ok' };
  }

  openRowDetail(row: any): void {
    this.activeRow = row;
    this.dialogTitle = row.district + ' · ' + row.division;
    this.dialogChartData = {
      labels: ['Completed', 'In progress', 'Not started', 'Overdue'],
      datasets: [{
        data: [row.completed, row.inProgress, row.notStarted, row.overdue],
        backgroundColor: [PALETTE.success, PALETTE.info, PALETTE.warning, PALETTE.danger], borderWidth: 0
      }]
    };
    this.dialogVisible = true;
  }
  closeDialog(): void { this.dialogVisible = false; this.activeRow = null; }

  onSearch(): void { this.first = 0; this.load(); }
  onFilterChange(): void { this.first = 0; this.load(); }
  export(): void { this.msg.add({ severity: 'info', summary: 'Export', detail: 'Generating TOD report…' }); }
  objectKeys(obj: any): string[] { return obj ? Object.keys(obj) : []; }
}
