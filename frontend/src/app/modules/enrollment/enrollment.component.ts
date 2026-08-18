import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { PALETTE, DIVISIONS, FINANCIAL_YEARS } from '../../core/models';

@Component({
  selector: 'app-enrollment',
  templateUrl: './enrollment.component.html',
  styleUrls: ['./enrollment.component.scss'],
  providers: [MessageService]
})
export class EnrollmentComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  fyOptions = FINANCIAL_YEARS.map(y => ({ label: y, value: y }));
  divOptions = DIVISIONS.map(d => ({ label: d, value: d }));
  selectedFY = 'FY 2025-26';
  selectedDiv = 'All Divisions';
  searchTerm = '';

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
    this.ds.getEnrollSummary().pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.summary = s;
      const absent = Math.max(0, (s.totalStudents || 0) - (s.present || 0));
      this.kpis = [
        { label: 'Total students',  value: s.totalStudents,  icon: 'pi-users',       accent: PALETTE.navy,    soft: PALETTE.navySoft },
        { label: 'Present today',   value: s.present,        icon: 'pi-check-circle',accent: PALETTE.success, soft: PALETTE.successSoft },
        { label: 'Attendance rate', value: s.attendancePct,  icon: 'pi-percentage',  accent: PALETTE.gold,    soft: PALETTE.goldSoft, suffix: '%' },
        { label: 'Absent',          value: absent,           icon: 'pi-user-minus',  accent: PALETTE.danger,  soft: PALETTE.dangerSoft },
        { label: 'Institutes',      value: s.totalInstitutes,icon: 'pi-building',    accent: PALETTE.info,    soft: PALETTE.infoSoft },
        { label: 'Courses',         value: s.totalCourses,   icon: 'pi-book',        accent: PALETTE.warning, soft: PALETTE.warningSoft },
      ];
    });
    this.ds.getEnrollDivisionSummary().pipe(takeUntil(this.destroy$)).subscribe(dc => {
      this.chartData = {
        labels: dc.map((d: any) => d.division),
        datasets: [
          { label: 'Present', data: dc.map((d: any) => d.present),                       backgroundColor: PALETTE.success, borderRadius: 4, barThickness: 18 },
          { label: 'Absent',  data: dc.map((d: any) => Math.max(0, d.students - d.present)), backgroundColor: PALETTE.danger, borderRadius: 4, barThickness: 18 },
        ]
      };
    });
    this.load();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  load(): void {
    this.loading = true;
    this.ds.getEnrollInstitutes(this.selectedDiv, this.searchTerm)
      .pipe(takeUntil(this.destroy$))
      .subscribe(rows => { this.tableData = rows; this.loading = false; });
  }

  statusPill(r: any): { text: string; cls: string } {
    return r.status === 'Completed'
      ? { text: 'Completed', cls: 'pill-ok' }
      : { text: 'Ongoing', cls: 'pill-info' };
  }
  gradePill(g: string): string {
    const key = (g || '').toLowerCase();
    if (key === 'excellent') return 'pill-ok';
    if (key === 'good') return 'pill-info';
    if (key === 'average') return 'pill-warn';
    return 'pill-bad';
  }
  attPct(r: any): number {
    if (r.attendancePct != null && r.attendancePct <= 1) return Math.round(r.attendancePct * 100);
    if (r.attendancePct != null) return Math.round(r.attendancePct);
    return r.totalStudents ? Math.round((r.present / r.totalStudents) * 100) : 0;
  }
  barColor(p: number): string {
    if (p >= 85) return PALETTE.success;
    if (p >= 70) return PALETTE.info;
    if (p >= 50) return PALETTE.warning;
    return PALETTE.danger;
  }

  openRowDetail(row: any): void {
    this.activeRow = row;
    this.dialogTitle = row.institute + ' · ' + row.district;
    const absent = Math.max(0, (row.totalStudents || 0) - (row.present || 0));
    this.dialogChartData = {
      labels: ['Present', 'Absent'],
      datasets: [{ data: [row.present, absent], backgroundColor: [PALETTE.success, PALETTE.danger], borderWidth: 0 }]
    };
    this.dialogVisible = true;
  }
  closeDialog(): void { this.dialogVisible = false; this.activeRow = null; }

  onSearch(): void { this.first = 0; this.load(); }
  onFilterChange(): void { this.first = 0; this.load(); }
  export(): void { this.msg.add({ severity: 'info', summary: 'Export', detail: 'Generating enrollment report…' }); }
  objectKeys(obj: any): string[] { return obj ? Object.keys(obj) : []; }
}
