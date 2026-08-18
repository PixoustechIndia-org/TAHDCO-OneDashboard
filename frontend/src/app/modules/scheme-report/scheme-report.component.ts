import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { PALETTE, FINANCIAL_YEARS } from '../../core/models';

@Component({
  selector: 'app-scheme-report',
  templateUrl: './scheme-report.component.html',
  styleUrls: ['./scheme-report.component.scss'],
  providers: [MessageService]
})
export class SchemeReportComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  fyOptions = FINANCIAL_YEARS.map(y => ({ label: y, value: y }));
  divisionOptions = [
    { label: 'All Divisions', value: 'All Divisions' },
    { label: 'Chennai', value: 'Chennai' },
    { label: 'Coimbatore', value: 'Coimbatore' },
    { label: 'Madurai', value: 'Madurai' },
    { label: 'Salem', value: 'Salem' },
    { label: 'Thanjavur', value: 'Thanjavur' },
    { label: 'Trichy', value: 'Trichy' },
    { label: 'Vellore', value: 'Vellore' },
    { label: 'Villupuram', value: 'Villupuram' }
  ];

  /** project name → appAccess key; options and rows are limited to what the role can see */
  private readonly PROJECT_APP: Record<string, string> = {
    'TAHDCO Scheme': 'Scheme', 'TELP': 'TELP', 'ONO PORTAL': 'OnePortal', 'TNCWWB': 'TNCWWB'
  };
  projectOptions: { label: string; value: string }[] = [];
  selectedFY = 'FY 2025-26';
  selectedProject = 'All Projects';
  selectedDivision = 'All Divisions';
  searchTerm = '';
  isTelpMode = false;

  tableData: any[] = [];
  telpTableRows: any[] = [];
  totals: any = {};
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
      x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 60, minRotation: 0 } },
      y: { stacked: true, grid: { color: '#f2f2f8' }, ticks: { font: { size: 10 } }, beginAtZero: true }
    }
  };

  get user() { return this.auth.getUser(); }
  constructor(
    public auth: AuthService, 
    private ds: DataService, 
    private msg: MessageService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const allowed = Object.keys(this.PROJECT_APP)
      .filter(pr => this.auth.hasAppAccess(this.PROJECT_APP[pr]));
    this.projectOptions = [
      { label: 'All Projects', value: 'All Projects' },
      ...allowed.map(pr => ({ label: pr, value: pr }))
    ];

    if (this.router.url.includes('/telp')) {
      this.isTelpMode = true;
      this.selectedProject = 'TELP';
    }

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['project'] === 'TELP' || params['app'] === 'TELP') {
        this.selectedProject = 'TELP';
        this.isTelpMode = true;
      }
      if (params['division']) this.selectedDivision = params['division'];
      if (params['year'] || params['fy']) this.selectedFY = params['year'] || params['fy'];
      this.load();
    });
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  approved(r: any): number {
    return Math.max(0, (r.apply || 0) - (r.dmPending || 0) - (r.hqPending || 0) - (r.paymentPending || 0));
  }
  approvalPct(r: any): number {
    return r.apply ? Math.round((this.approved(r) / r.apply) * 100) : 0;
  }
  barColor(p: number): string {
    if (p >= 80) return PALETTE.success;
    if (p >= 60) return PALETTE.info;
    if (p >= 40) return PALETTE.warning;
    return PALETTE.danger;
  }

  load(): void {
    this.loading = true;
    if (this.selectedProject === 'TELP' || this.isTelpMode) {
      this.ds.getTelpLoanDatabase(this.selectedFY, this.selectedDivision, undefined, this.searchTerm)
        .pipe(takeUntil(this.destroy$))
        .subscribe(telpRows => {
          this.telpTableRows = telpRows;
          const apply = telpRows.reduce((a: number, r: any) => a + (r.noOfSchemeApply || 0), 0);
          const paymentPending = telpRows.reduce((a: number, r: any) => a + (r.paymentPending || 0), 0);
          const paymentCompleted = telpRows.reduce((a: number, r: any) => a + (r.paymentCompleted || 0), 0);
          
          this.kpis = [
            { label: 'Total Applications', value: apply, icon: 'pi-file', accent: PALETTE.navy, soft: PALETTE.navySoft },
            { label: 'Payment Completed', value: paymentCompleted, icon: 'pi-check-circle', accent: PALETTE.success, soft: PALETTE.successSoft },
            { label: 'Payment Pending', value: paymentPending, icon: 'pi-hourglass', accent: PALETTE.info, soft: PALETTE.infoSoft },
            { label: 'Total Districts', value: new Set(telpRows.map((r: any) => r.district)).size, icon: 'pi-map-marker', accent: PALETTE.warning, soft: PALETTE.warningSoft }
          ];
          this.loading = false;
        });
    } else {
      this.ds.getSchemes(this.selectedProject, this.searchTerm)
        .pipe(takeUntil(this.destroy$))
        .subscribe(rows => {
          rows = rows.filter((r: any) => this.auth.hasAppAccess(this.PROJECT_APP[r.project] || ''));
          this.tableData = rows;
          const sum = (k: string) => rows.reduce((a: number, r: any) => a + (r[k] || 0), 0);
          const apply = sum('apply');
          const approved = rows.reduce((a: number, r: any) => a + this.approved(r), 0);
          this.totals = {
            apply, approved,
            dmPending: sum('dmPending'), hqPending: sum('hqPending'), paymentPending: sum('paymentPending'),
            count: rows.length
          };
          this.kpis = [
            { label: 'Applications',    value: apply,                    icon: 'pi-file',         accent: PALETTE.navy,    soft: PALETTE.navySoft },
            { label: 'Approved',        value: approved,                 icon: 'pi-check-circle', accent: PALETTE.success, soft: PALETTE.successSoft },
            { label: 'DM pending',      value: this.totals.dmPending,    icon: 'pi-hourglass',    accent: PALETTE.info,    soft: PALETTE.infoSoft },
            { label: 'HQ pending',      value: this.totals.hqPending,    icon: 'pi-clock',        accent: PALETTE.warning, soft: PALETTE.warningSoft },
            { label: 'Payment pending', value: this.totals.paymentPending,icon: 'pi-wallet',      accent: PALETTE.gold,    soft: PALETTE.goldSoft },
            { label: 'Schemes',         value: this.totals.count,        icon: 'pi-th-large',     accent: PALETTE.danger,  soft: PALETTE.dangerSoft },
          ];
          this.buildChart(rows);
          this.loading = false;
        });
    }
  }

  private buildChart(rows: any[]): void {
    this.chartData = {
      labels: rows.map(r => r.scheme),
      datasets: [
        { label: 'Approved',        data: rows.map(r => this.approved(r)),   backgroundColor: PALETTE.success, borderRadius: 4, barThickness: 16 },
        { label: 'DM pending',      data: rows.map(r => r.dmPending),        backgroundColor: PALETTE.info,    borderRadius: 4, barThickness: 16 },
        { label: 'HQ pending',      data: rows.map(r => r.hqPending),        backgroundColor: PALETTE.warning, borderRadius: 4, barThickness: 16 },
        { label: 'Payment pending', data: rows.map(r => r.paymentPending),   backgroundColor: PALETTE.gold,    borderRadius: 4, barThickness: 16 },
      ]
    };
  }

  projectPill(p: string): string {
    if (p === 'TAHDCO Scheme') return 'pill-navy';
    if (p === 'TELP') return 'pill-info';
    if (p === 'TNCWWB') return 'pill-ok';
    return 'pill-gold';
  }

  openRowDetail(row: any): void {
    this.activeRow = row;
    this.dialogTitle = row.scheme + ' · ' + row.project;
    this.dialogChartData = {
      labels: ['Approved', 'DM pending', 'HQ pending', 'Payment pending'],
      datasets: [{
        data: [this.approved(row), row.dmPending, row.hqPending, row.paymentPending],
        backgroundColor: [PALETTE.success, PALETTE.info, PALETTE.warning, PALETTE.gold], borderWidth: 0
      }]
    };
    this.dialogVisible = true;
  }
  closeDialog(): void { this.dialogVisible = false; this.activeRow = null; }

  onSearch(): void { this.first = 0; this.load(); }
  onFilterChange(): void { this.first = 0; this.load(); }
  export(): void { this.msg.add({ severity: 'info', summary: 'Export', detail: 'Generating scheme report…' }); }
  objectKeys(obj: any): string[] { return obj ? Object.keys(obj) : []; }
}
