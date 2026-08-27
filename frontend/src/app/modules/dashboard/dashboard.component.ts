import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import {
  DIVISIONS, FINANCIAL_YEARS, PALETTE,
  DashboardMode, DASHBOARD_LENSES, ROLE_META
} from '../../core/models';

// extra hues not in PALETTE
const TEAL = '#0f7d6b';
const PURPLE = '#5b3fb0';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ── Lens switching ─────────────────────────────────────────────
  lenses = DASHBOARD_LENSES;
  mode: DashboardMode = 'strategic';

  // ── Filters (used by Analytical) ───────────────────────────────
  fyOptions = FINANCIAL_YEARS.map(y => ({ label: y, value: y }));
  divOptions = DIVISIONS.map(d => ({ label: d, value: d }));
  selectedFY = 'FY 2025-26';
  selectedDiv = 'All Divisions';

  loading = true;

  // ── View models per lens ───────────────────────────────────────
  health = 0;
  headline: { label: string; value: string; sub: string }[] = [];
  rings: any[] = [];
  targets: any[] = [];
  leaderboard: any[] = [];
  risks: any[] = [];

  liveTiles: any[] = [];
  cameraUptime = 0;
  offlineBars: any[] = [];
  taskBoard: any[] = [];
  alerts: any[] = [];
  activity: any[] = [];

  scorecards: any[] = [];
  bottlenecks: any[] = [];
  movers: any[] = [];

  // ── Charts ─────────────────────────────────────────────────────
  worksChart: any = { labels: [], datasets: [] };
  worksChartOpts: any = {};
  tenderDivChart: any = { labels: [], datasets: [] };
  tenderDivChartOpts: any = {};
  stagesChart: any = { labels: [], datasets: [] };
  stagesChartOpts: any = {};
  schemeChart: any = { labels: [], datasets: [] };
  schemeChartOpts: any = {};
  genderChart: any = { labels: [], datasets: [] };
  genderChartOpts: any = {};
  trendChart: any = { labels: [], datasets: [] };
  trendChartOpts: any = {};

  get user() { return this.auth.getUser(); }
  get greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }
  get today(): string {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  get clock(): string {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  get activeLens() { return this.lenses.find(l => l.mode === this.mode)!; }
  get activeIndex() { return this.lenses.findIndex(l => l.mode === this.mode); }

  constructor(
    public auth: AuthService,
    private ds: DataService,
    private msg: MessageService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // default lens follows the signed-in role
    const role = this.user?.role;
    if (role && ROLE_META[role]) this.mode = ROLE_META[role].defaultMode;
    this.load();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  setMode(m: DashboardMode): void { this.mode = m; this.cdr.markForCheck(); }

  trackByIndex(i: number): number { return i; }
  trackByKey(_i: number, o: any): string { return o.key ?? o.label ?? String(_i); }

  pct(a: number, b: number): number { return b ? Math.round((a / b) * 100) : 0; }

  formatNum(n: number | string): string {
    if (typeof n === 'string') return n;
    if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  statusTone(p: number): { cls: string; label: string } {
    if (p >= 90) return { cls: 'ok', label: 'On track' };
    if (p >= 70) return { cls: 'warn', label: 'Watch' };
    return { cls: 'bad', label: 'At risk' };
  }

  load(): void {
    this.loading = true;
    this.buildChartOptions();

    forkJoin({
      tender: this.ds.getTenderSummary(),
      tenderDivs: this.ds.getTenderDivisionCounts(),
      housing: this.ds.getHousingOverall(),
      schemes: this.ds.getSchemes(),
      enroll: this.ds.getEnrollSummary(),
      enrollDist: this.ds.getEnrollDistricts(),
      monthly: this.ds.getMonthlyCompletion(),
      tod: this.ds.getTodSummary(),
      patrol: this.ds.getPatrolSummary(),
      offline: this.ds.getOfflineDuration(),
    }).pipe(takeUntil(this.destroy$)).subscribe(d => {
      this.buildModels(d);
      this.buildCharts(d);
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  // ══ VIEW MODELS ══════════════════════════════════════════════════
  private buildModels(d: any): void {
    const t = d.tender, h = d.housing, e = d.enroll, tod = d.tod, p = d.patrol, off = d.offline;
    const applied = d.schemes.reduce((s: number, r: any) => s + r.apply, 0);
    const dmPend = d.schemes.reduce((s: number, r: any) => s + r.dmPending, 0);
    const hqPend = d.schemes.reduce((s: number, r: any) => s + r.hqPending, 0);
    const payPend = d.schemes.reduce((s: number, r: any) => s + r.paymentPending, 0);
    const approved = Math.max(0, applied - dmPend - hqPend - payPend);

    const housingPct = this.pct(h.completed, h.totalHouses);
    const commencedPct = this.pct(t.started, t.totalWorks);
    const schemePct = this.pct(approved, applied);
    const enrollTarget = 3500;
    const enrollPct = this.pct(e.totalStudents, enrollTarget);
    this.cameraUptime = this.pct(p.currentActive, p.cameraInstalled);
    const cameraCoveragePct = this.pct(p.cameraInstalled, p.totalWorks);

    // Composite corporation health
    this.health = Math.round((housingPct + commencedPct + schemePct + enrollPct + this.cameraUptime) / 5);

    // ── STRATEGIC ──
    this.headline = [
      { label: 'Homes delivered', value: this.formatNum(h.completed), sub: `of ${this.formatNum(h.totalHouses)} sanctioned` },
      { label: 'Works commenced', value: this.formatNum(t.started), sub: `of ${this.formatNum(t.totalWorks)} tenders` },
      { label: 'Citizens trained', value: this.formatNum(e.totalStudents), sub: `${this.formatNum(e.newEnrollment)} new this month` },
    ];
    this.rings = [
      { key: 'housing', label: this.ds.getProjectDisplayName('THMS', 'Housing delivery'), pct: housingPct, value: h.completed, target: h.totalHouses, color: PALETTE.success, icon: 'pi-building' },
      { key: 'tender',  label: this.ds.getProjectDisplayName('TIPS', 'Works commenced'),  pct: commencedPct, value: t.started, target: t.totalWorks, color: PALETTE.navy, icon: 'pi-file-edit' },
      { key: 'scheme',  label: this.ds.getProjectDisplayName('SCHEME', 'Scheme approvals'), pct: schemePct, value: approved, target: applied, color: PALETTE.gold, icon: 'pi-wallet' },
      { key: 'enroll',  label: this.ds.getProjectDisplayName('TAMS', 'Skill training'),   pct: enrollPct, value: e.totalStudents, target: enrollTarget, color: PALETTE.info, icon: 'pi-graduation-cap' },
    ];
    this.targets = [
      { label: this.ds.getProjectDisplayName('THMS', 'Housing delivery'), value: h.completed, target: h.totalHouses, pct: housingPct, color: PALETTE.success },
      { label: this.ds.getProjectDisplayName('TIPS', 'Works commenced'), value: t.started, target: t.totalWorks, pct: commencedPct, color: PALETTE.navy },
      { label: this.ds.getProjectDisplayName('SCHEME', 'Scheme approvals'), value: approved, target: applied, pct: schemePct, color: PALETTE.gold },
      { label: this.ds.getProjectDisplayName('TAMS', 'Skill training'), value: e.totalStudents, target: enrollTarget, pct: enrollPct, color: PALETTE.info },
      { label: this.ds.getProjectDisplayName('PATROL360', 'CCTV coverage'), value: p.cameraInstalled, target: p.totalWorks, pct: cameraCoveragePct, color: TEAL },
    ];
    this.leaderboard = [...d.tenderDivs]
      .map((c: any) => ({
        key: c.division, division: c.division, works: c.totalWorks, mBooks: c.mBooks,
        pct: this.pct(c.inProgress + c.completed, c.totalWorks)
      }))
      .sort((a: any, b: any) => b.pct - a.pct)
      .slice(0, 6);
    this.risks = [
      { key: 'pay', sev: 'danger', icon: 'pi-indian-rupee', label: 'Contractor payments pending', count: t.paymentPending, note: 'Finance', hint: 'Clearance needed to sustain work pace' },
      { key: 'slow', sev: 'warn', icon: 'pi-clock', label: 'Slow-progress works', count: t.slowProgress, note: 'Delivery', hint: 'Review with divisions & contractors' },
      { key: 'overdue', sev: 'warn', icon: 'pi-calendar-times', label: 'Overdue tasks & events', count: tod.overdue, note: 'Governance', hint: 'Escalate to district owners' },
      { key: 'cam', sev: 'danger', icon: 'pi-video', label: 'Cameras offline > 10 days', count: off.moreThan10Days, note: 'Assets', hint: 'Dispatch maintenance teams' },
    ];

    // ── OPERATIONAL ──
    this.liveTiles = [
      { key: 'wip', label: 'Works in progress', value: t.inProgress, icon: 'pi-cog', tone: 'navy', foot: `${t.slowProgress} slow` },
      { key: 'cam', label: 'Cameras online', value: p.currentActive, icon: 'pi-video', tone: 'teal', foot: `${p.currentInactive} offline` },
      { key: 'task', label: 'Active tasks', value: tod.inProgress, icon: 'pi-list-check', tone: 'gold', foot: `${tod.notStarted} not started` },
      { key: 'over', label: 'Overdue items', value: tod.overdue, icon: 'pi-exclamation-triangle', tone: 'danger', foot: 'Needs action' },
    ];
    this.offlineBars = [
      { label: '< 2 days', value: off.lessThan2Days, color: PALETTE.warning },
      { label: '3–10 days', value: off.between3To10Days, color: '#d97706' },
      { label: '> 10 days', value: off.moreThan10Days, color: PALETTE.danger },
    ];
    const taskTotal = tod.notStarted + tod.inProgress + tod.completed + tod.overdue;
    this.taskBoard = [
      { label: 'Not started', value: tod.notStarted, color: PALETTE.gray400, pct: this.pct(tod.notStarted, taskTotal) },
      { label: 'In progress', value: tod.inProgress, color: PALETTE.navy, pct: this.pct(tod.inProgress, taskTotal) },
      { label: 'Completed', value: tod.completed, color: PALETTE.success, pct: this.pct(tod.completed, taskTotal) },
      { label: 'Overdue', value: tod.overdue, color: PALETTE.danger, pct: this.pct(tod.overdue, taskTotal) },
    ];
    this.alerts = [
      { sev: 'danger', icon: 'pi-video', title: `${off.moreThan10Days} cameras offline over 10 days`, action: 'Dispatch technician' },
      { sev: 'danger', icon: 'pi-indian-rupee', title: `${t.paymentPending} contractor payments pending`, action: 'Clear with accounts' },
      { sev: 'warn', icon: 'pi-clock', title: `${t.slowProgress} works flagged slow-progress`, action: 'Review schedule' },
      { sev: 'warn', icon: 'pi-calendar-times', title: `${tod.overdue} tasks are overdue`, action: 'Escalate to owners' },
      { sev: 'info', icon: 'pi-upload', title: `${t.mBookPending} M-Books awaiting upload`, action: 'Remind engineers' },
    ];
    this.activity = [
      { time: '9 min ago', icon: 'pi-file-edit', tone: 'navy', text: 'New tender awarded in Coimbatore division' },
      { time: '34 min ago', icon: 'pi-building', tone: 'success', text: 'Roof-level reached for 6 houses in Salem' },
      { time: '1 hr ago', icon: 'pi-video', tone: 'teal', text: 'Camera #TN-142 back online after maintenance' },
      { time: '2 hr ago', icon: 'pi-wallet', tone: 'gold', text: '18 scheme applications approved at HQ' },
      { time: '3 hr ago', icon: 'pi-check-circle', tone: 'success', text: '12 diary tasks marked complete in Madurai' },
    ];

    // ── TACTICAL ──
    this.scorecards = [...d.tenderDivs].map((c: any) => {
      const pr = this.pct(c.inProgress + c.completed, c.totalWorks);
      const st = this.statusTone(pr);
      return { key: c.division, division: c.division, works: c.totalWorks, mBooks: c.mBooks, inProgress: c.inProgress, notStarted: c.notStarted, pct: pr, cls: st.cls, status: st.label };
    }).sort((a: any, b: any) => b.pct - a.pct);

    const bnTotal = t.totalWorks;
    this.bottlenecks = [
      { key: 'slow', label: 'Works stuck in slow-progress', count: t.slowProgress, of: bnTotal, sev: 'warn', owner: 'Divisions' },
      { key: 'noact', label: 'M-Books with no action taken', count: t.noAction, of: t.mBookTotal, sev: 'warn', owner: 'Field engineers' },
      { key: 'dm', label: 'Scheme approvals pending at DM', count: dmPend, of: applied, sev: 'warn', owner: 'District managers' },
      { key: 'hq', label: 'Scheme approvals pending at HQ', count: hqPend, of: applied, sev: 'info', owner: 'Headquarters' },
      { key: 'pay', label: 'Payments pending release', count: payPend + t.paymentPending, of: applied, sev: 'danger', owner: 'Finance' },
      { key: 'notstart', label: 'Tenders not yet commenced', count: t.notStarted, of: bnTotal, sev: 'danger', owner: 'Divisions' },
    ].map(b => ({ ...b, pct: this.pct(b.count, b.of) }))
     .sort((a, b) => b.count - a.count);

    this.movers = [...this.targets]
      .map(t2 => ({ label: t2.label, gap: Math.max(0, t2.target - t2.value), pct: t2.pct, color: t2.color }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);
  }

  // ══ CHART OPTIONS ════════════════════════════════════════════════
  private buildChartOptions(): void {
    const grid = '#eef1f6';
    const font = { size: 10, family: 'Inter' };
    const legendTop = {
      legend: { position: 'top', align: 'end', labels: { font, boxWidth: 9, boxHeight: 9, padding: 12, usePointStyle: true, pointStyle: 'circle' } }
    };

    this.worksChartOpts = {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: { legend: { position: 'bottom', labels: { font, boxWidth: 8, padding: 12, usePointStyle: true, pointStyle: 'circle' } } }
    };
    this.genderChartOpts = {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: { legend: { position: 'bottom', labels: { font, boxWidth: 8, padding: 12, usePointStyle: true, pointStyle: 'circle' } } }
    };
    this.tenderDivChartOpts = {
      responsive: true, maintainAspectRatio: false,
      plugins: legendTop,
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font, maxRotation: 40, minRotation: 0 } },
        y: { stacked: true, grid: { color: grid }, ticks: { font }, beginAtZero: true }
      }
    };
    this.schemeChartOpts = {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: legendTop,
      scales: {
        x: { stacked: true, grid: { color: grid }, ticks: { font }, beginAtZero: true },
        y: { stacked: true, grid: { display: false }, ticks: { font } }
      }
    };
    this.stagesChartOpts = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {} } },
      scales: {
        x: { grid: { display: false }, ticks: { font } },
        y: { grid: { color: grid }, ticks: { font }, beginAtZero: true }
      }
    };
    this.trendChartOpts = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font } },
        y: { grid: { color: grid }, ticks: { font }, beginAtZero: true }
      }
    };
  }

  private buildCharts(d: any): void {
    const t = d.tender, e = d.enroll, h = d.housing;

    // Works status (operational)
    this.worksChart = {
      labels: ['In progress', 'Slow progress', 'Not started', 'Completed'],
      datasets: [{
        data: [t.inProgress - t.slowProgress > 0 ? t.inProgress - t.slowProgress : t.inProgress, t.slowProgress, t.notStarted, t.completed],
        backgroundColor: [PALETTE.navy, PALETTE.warning, PALETTE.gray400, PALETTE.success],
        borderWidth: 0, hoverOffset: 6
      }]
    };

    // Tender status by division (analytical)
    this.tenderDivChart = {
      labels: d.tenderDivs.map((c: any) => c.division),
      datasets: [
        { label: 'In progress', data: d.tenderDivs.map((c: any) => c.inProgress), backgroundColor: PALETTE.navy, borderRadius: 5, maxBarThickness: 22 },
        { label: 'Not started', data: d.tenderDivs.map((c: any) => c.notStarted), backgroundColor: PALETTE.danger, borderRadius: 5, maxBarThickness: 22 },
        { label: 'Completed', data: d.tenderDivs.map((c: any) => c.completed), backgroundColor: PALETTE.gold, borderRadius: 5, maxBarThickness: 22 },
      ]
    };

    // Housing construction stages (analytical)
    this.stagesChart = {
      labels: ['Grade beam', 'Basement', 'Lintel', 'Roof', 'Completed'],
      datasets: [{
        label: 'Houses',
        data: [h.gradBeam, h.basement, h.lintelLevel, h.roofLevel, h.completed],
        backgroundColor: ['#3466ad', '#234f8c', '#1b5fa5', '#b7770a', '#1c7a4a'],
        borderRadius: 6, maxBarThickness: 54
      }]
    };

    // Scheme by project (analytical)
    const byProject: Record<string, { ap: number; dm: number; hq: number; pay: number }> = {};
    d.schemes.forEach((s: any) => {
      const k = s.project;
      if (!byProject[k]) byProject[k] = { ap: 0, dm: 0, hq: 0, pay: 0 };
      byProject[k].ap += s.apply; byProject[k].dm += s.dmPending;
      byProject[k].hq += s.hqPending; byProject[k].pay += s.paymentPending;
    });
    const projects = Object.keys(byProject);
    this.schemeChart = {
      labels: projects,
      datasets: [
        { label: 'Approved', data: projects.map(p => Math.max(0, byProject[p].ap - byProject[p].dm - byProject[p].hq - byProject[p].pay)), backgroundColor: PALETTE.success, borderRadius: 5, maxBarThickness: 26 },
        { label: 'DM pending', data: projects.map(p => byProject[p].dm), backgroundColor: PALETTE.gold, borderRadius: 5, maxBarThickness: 26 },
        { label: 'HQ pending', data: projects.map(p => byProject[p].hq), backgroundColor: PALETTE.info, borderRadius: 5, maxBarThickness: 26 },
        { label: 'Payment pending', data: projects.map(p => byProject[p].pay), backgroundColor: PALETTE.danger, borderRadius: 5, maxBarThickness: 26 },
      ]
    };

    // Gender split (analytical)
    this.genderChart = {
      labels: ['Female', 'Male', 'Others'],
      datasets: [{
        data: [e.female, e.male, e.others || 0],
        backgroundColor: [PALETTE.gold, PALETTE.navy, PALETTE.gray400],
        borderWidth: 0, hoverOffset: 6
      }]
    };

    // Monthly completions (analytical)
    this.trendChart = {
      labels: d.monthly.map((m: any) => m.month),
      datasets: [{
        label: 'Completions', data: d.monthly.map((m: any) => m.count),
        borderColor: PALETTE.navy, backgroundColor: 'rgba(35,79,140,.10)',
        borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 5,
        pointBackgroundColor: PALETTE.gold, fill: true, tension: 0.4
      }]
    };
  }

  refresh(): void {
    this.msg.add({ severity: 'success', summary: 'Dashboard updated', detail: 'Latest figures loaded.' });
    this.load();
  }

  exportView(): void {
    this.msg.add({ severity: 'info', summary: 'Preparing export', detail: `${this.activeLens.title} dashboard is being exported.` });
  }

  openModule(route: string): void { this.router.navigate([route]); }
}
