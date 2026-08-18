import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { PALETTE, DIVISIONS, FINANCIAL_YEARS } from '../../core/models';

@Component({
  selector: 'app-tender',
  templateUrl: './tender.component.html',
  styleUrls: ['./tender.component.scss'],
  providers: [MessageService]
})
export class TenderComponent implements OnInit, OnDestroy {
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
    this.ds.getTenderSummary().pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.summary = s;
      this.kpis = [
        { label: 'Total works',    value: s.totalWorks,     icon: 'pi-briefcase',  accent: PALETTE.navy,    soft: PALETTE.navySoft },
        { label: 'In progress',    value: s.inProgress,     icon: 'pi-spin pi-cog',accent: PALETTE.info,    soft: PALETTE.infoSoft },
        { label: 'Slow progress',  value: s.slowProgress,   icon: 'pi-clock',      accent: PALETTE.warning, soft: PALETTE.warningSoft },
        { label: 'Not started',    value: s.notStarted,     icon: 'pi-ban',        accent: PALETTE.danger,  soft: PALETTE.dangerSoft },
        { label: 'M-books uploaded',value: s.mBookUploaded, icon: 'pi-file-check', accent: PALETTE.success, soft: PALETTE.successSoft },
        { label: 'Payment pending',value: s.paymentPending, icon: 'pi-wallet',     accent: PALETTE.gold,    soft: PALETTE.goldSoft },
      ];
    });
    this.ds.getTenderDivisionCounts().pipe(takeUntil(this.destroy$)).subscribe(dc => {
      this.chartData = {
        labels: dc.map((d: any) => d.division),
        datasets: [
          { label: 'In progress', data: dc.map((d: any) => d.inProgress),   backgroundColor: PALETTE.info,    borderRadius: 4, barThickness: 18 },
          { label: 'Slow',        data: dc.map((d: any) => d.slowProgress), backgroundColor: PALETTE.warning, borderRadius: 4, barThickness: 18 },
          { label: 'Not started', data: dc.map((d: any) => d.notStarted),   backgroundColor: PALETTE.danger,  borderRadius: 4, barThickness: 18 },
        ]
      };
    });
    this.load();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  load(): void {
    this.loading = true;
    this.ds.getTenderDistricts(this.selectedDiv, this.searchTerm)
      .pipe(takeUntil(this.destroy$))
      .subscribe(rows => { this.tableData = rows; this.loading = false; });
  }

  statusPill(r: any): { text: string; cls: string } {
    if (r.notStarted > 0) return { text: r.notStarted + ' not started', cls: 'pill-bad' };
    if (r.slowProgress > 0) return { text: r.slowProgress + ' slow', cls: 'pill-warn' };
    return { text: 'On track', cls: 'pill-ok' };
  }

  openRowDetail(row: any): void {
    this.activeRow = row;
    this.dialogTitle = row.district + ' · ' + row.division;
    this.dialogChartData = {
      labels: ['In progress', 'Completed', 'Slow', 'Not started'],
      datasets: [{
        data: [row.inProgress, row.completed, row.slowProgress, row.notStarted],
        backgroundColor: [PALETTE.info, PALETTE.success, PALETTE.warning, PALETTE.danger], borderWidth: 0
      }]
    };
    this.dialogVisible = true;
  }
  closeDialog(): void { this.dialogVisible = false; this.activeRow = null; }

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

  onSearch(): void { this.first = 0; this.load(); }
  onFilterChange(): void { this.first = 0; this.load(); }
  export(): void { this.msg.add({ severity: 'info', summary: 'Export', detail: 'Generating tender report…' }); }
  objectKeys(obj: any): string[] { return obj ? Object.keys(obj) : []; }
}
