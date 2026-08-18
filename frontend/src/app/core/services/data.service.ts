import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, combineLatest } from 'rxjs';
import { map, shareReplay, catchError, switchMap, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  TenderSummary, TenderDivisionCount, TenderWork, MBook,
  HousingOverall, HousingDistrict,
  SchemeItem, SchemeDistrictBreakdown,
  EnrollSummary, EnrollDistrict, MonthlyCompletion,
  TodSummary, TodDistrict,
  PatrolSummary, PatrolDistrict, OfflineDuration,
  KpiCard, FilterState, PALETTE, ModuleTile, DrillConfig, DrillRow,
  ClickContext, DashboardCacheResult, DashboardDataStatus, DashboardRefreshResult,
  NormalizedCount, NormalizedDetailRecord, DashboardModuleKey
} from '../models';

@Injectable({ providedIn: 'root' })
export class DataService {
  private data$!: Observable<any>;
  private fySubject = new BehaviorSubject<string>('FY 2025-26');
  // Refresh trigger — emit a new value to force a reload (e.g. after login)
  private refreshTrigger = new BehaviorSubject<number>(0);
  private filterSubject = new BehaviorSubject<FilterState>({
    financialYear: 'FY 2025-26', division: 'All Divisions',
    district: 'All Districts', phase: 'All Phases'
  });
  filter$ = this.filterSubject.asObservable();

  public globalFilters$ = new BehaviorSubject<{ selFY: string[], selDiv: string[], viewMode: 'count' | 'cost' | 'both' }>({
    selFY: ['FY 2025-26'],
    selDiv: [],
    viewMode: 'count'
  });

  setGlobalFilters(filters: Partial<{ selFY: string[], selDiv: string[], viewMode: 'count' | 'cost' | 'both' }>): void {
    this.globalFilters$.next({ ...this.globalFilters$.value, ...filters });
  }

  constructor(private http: HttpClient) {
    // Reload whenever FY changes OR refresh() is called (e.g. post-login).
    // Each emission produces a fresh HTTP call — no stale shareReplay caching
    // of unauthenticated responses.
    this.data$ = combineLatest([this.fySubject, this.refreshTrigger]).pipe(
      switchMap(([fy]) => this.load(fy)),
      shareReplay(1)
    );
  }

  private cacheMap = new Map<string, Observable<any>>();
  private isBackendOnline: boolean = true;

  private checkBackendFailure(err: any): void {
    if (err && (err.status === 0 || err.status === 404 || err.status >= 500 || err.name === 'HttpErrorResponse')) {
      this.isBackendOnline = false;
    }
  }

  /** Force a full data reload — call this right after a successful login. */
  refresh(): void {
    this.cacheMap.clear();
    this.refreshTrigger.next(this.refreshTrigger.value + 1);
  }

  /** Purge all local storage and memory caches and reload fresh data */
  clearAllCache(fy?: string): Observable<any> {
    this.cacheMap.clear();
    try {
      if (typeof localStorage !== 'undefined') {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('TAHDCO_CACHE')) localStorage.removeItem(k);
        });
      }
    } catch (e) {}
    this.refreshTrigger.next(this.refreshTrigger.value + 1);
    return this.load(fy || 'FY 2025-26', true);
  }

  private load(fy: string, clearCache: boolean = false): Observable<any> {
    const cacheKey = `TAHDCO_CACHE_${fy}`;
    const local$ = this.http.get<any>('/assets/data/dashboard-data.json');

    if (clearCache) {
      try { localStorage.removeItem(cacheKey); } catch (e) {}
      this.cacheMap.delete(cacheKey);
    }

    if (!clearCache && this.cacheMap.has(cacheKey)) {
      return this.cacheMap.get(cacheKey)!;
    }

    let cachedData: any = null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) { cachedData = JSON.parse(raw); }
    } catch (e) {}

    const url = (environment.apiUrl && this.isBackendOnline)
      ? `${environment.apiUrl}/api/v1/dashboard/full?fy=${encodeURIComponent(fy)}${clearCache ? '&clearCache=true' : ''}`
      : null;

    const http$ = url
      ? this.http.get<any>(url).pipe(
          map(res => {
            if (res) {
              try { localStorage.setItem(cacheKey, JSON.stringify(res)); } catch (e) {}
            }
            return res;
          }),
          catchError((err) => {
            this.checkBackendFailure(err);
            return cachedData ? of(cachedData) : local$;
          })
        )
      : (cachedData ? of(cachedData) : local$);

    const req$ = cachedData && !clearCache
      ? of(cachedData).pipe(
          switchMap(cd => {
            if (this.isBackendOnline && url) {
              http$.subscribe({ error: (err) => this.checkBackendFailure(err) });
            }
            return of(cd);
          })
        )
      : http$;

    const shared$ = req$.pipe(shareReplay(1));
    this.cacheMap.set(cacheKey, shared$);
    return shared$;
  }

  /** Expose raw dashboard data observable for components needing the full object (e.g. DashboardMD). */
  getRawData(): Observable<any> { return this.data$; }

  /** Fetch raw dashboard data for a specific financial year (un-cached, for client-side aggregation). */
  getRawDataForYear(fy: string, clearCache: boolean = false): Observable<any> {
    return this.load(fy, clearCache);
  }

  /** Switch financial year — reloads the whole document from the API. */
  setFinancialYear(fy: string): void {
    this.fySubject.next(fy);
    this.setFilter({ financialYear: fy });
  }

  setFilter(f: Partial<FilterState>): void {
    this.filterSubject.next({ ...this.filterSubject.value, ...f });
  }
  getFilter(): FilterState { return this.filterSubject.value; }



  // ── Dashboard KPI cards ──────────────────────────────────────
  getKpiCards(): Observable<KpiCard[]> {
    return this.data$.pipe(map(d => [
      {
        id: 'tender', label: 'Total Tenders', value: d.tender.summary.totalWorks,
        subLabel: 'In progress', subValue: d.tender.summary.inProgress,
        icon: 'pi-file-edit', accent: PALETTE.navy, accentSoft: PALETTE.navySoft,
        trend: 'up' as const,
        detail: [
          { label: 'Not started', value: d.tender.summary.notStarted, color: PALETTE.danger },
          { label: 'In progress', value: d.tender.summary.inProgress, color: PALETTE.navy },
          { label: 'Slow progress', value: d.tender.summary.slowProgress, color: PALETTE.warning },
          { label: 'Completed', value: d.tender.summary.completed, color: PALETTE.success },
          { label: 'M-Books', value: d.tender.summary.mBookTotal, color: PALETTE.gold },
          { label: 'Payment pending', value: d.tender.summary.paymentPending, color: PALETTE.danger },
        ]
      },
      {
        id: 'housing', label: 'Houses (Phase 1)', value: d.housing.overall.totalHouses,
        subLabel: 'Completed', subValue: d.housing.overall.completed,
        icon: 'pi-building', accent: PALETTE.success, accentSoft: PALETTE.successSoft,
        trend: 'up' as const,
        detail: [
          { label: 'Started', value: d.housing.overall.started, color: PALETTE.navy },
          { label: 'Completed', value: d.housing.overall.completed, color: PALETTE.success },
          { label: 'Grade beam', value: d.housing.overall.gradBeam, color: PALETTE.info },
          { label: 'Basement', value: d.housing.overall.basement, color: PALETTE.gold },
          { label: 'Lintel level', value: d.housing.overall.lintelLevel, color: PALETTE.warning },
          { label: 'Roof level', value: d.housing.overall.roofLevel, color: PALETTE.navy },
        ]
      },
      {
        id: 'scheme', label: 'Scheme applications', value: d.schemes.reduce((s: number, r: any) => s + r.apply, 0),
        subLabel: 'DM pending', subValue: d.schemes.reduce((s: number, r: any) => s + r.dmPending, 0),
        icon: 'pi-wallet', accent: PALETTE.gold, accentSoft: PALETTE.goldSoft,
        trend: 'neutral' as const,
        detail: [
          { label: 'TAHDCO Scheme', value: d.schemes.filter((r: any) => r.project === 'TAHDCO Scheme').reduce((s: number, r: any) => s + r.apply, 0), color: PALETTE.navy },
          { label: 'TELP', value: d.schemes.filter((r: any) => r.project === 'TELP').reduce((s: number, r: any) => s + r.apply, 0), color: PALETTE.info },
          { label: 'ONO Portal', value: d.schemes.filter((r: any) => r.project === 'ONO PORTAL').reduce((s: number, r: any) => s + r.apply, 0), color: PALETTE.success },
          { label: 'HQ pending', value: d.schemes.reduce((s: number, r: any) => s + r.hqPending, 0), color: PALETTE.warning },
          { label: 'Payment pending', value: d.schemes.reduce((s: number, r: any) => s + r.paymentPending, 0), color: PALETTE.danger },
        ]
      },
      {
        id: 'enrollment', label: 'Enrollment (TAMS)', value: d.enrollment.summary.totalStudents,
        subLabel: 'New this month', subValue: d.enrollment.summary.newEnrollment,
        icon: 'pi-graduation-cap', accent: PALETTE.info, accentSoft: PALETTE.infoSoft,
        trend: 'up' as const,
        detail: [
          { label: 'Courses', value: d.enrollment.summary.totalCourses, color: PALETTE.navy },
          { label: 'Institutes', value: d.enrollment.summary.totalInstitutes, color: PALETTE.gold },
          { label: 'Male', value: d.enrollment.summary.male, color: PALETTE.info },
          { label: 'Female', value: d.enrollment.summary.female, color: PALETTE.success },
        ]
      },
      {
        id: 'tod', label: 'Tasks & Events', value: d.tod.summary.totalTasks,
        subLabel: 'Overdue', subValue: d.tod.summary.overdue,
        icon: 'pi-calendar', accent: PALETTE.warning, accentSoft: PALETTE.warningSoft,
        trend: 'down' as const,
        detail: [
          { label: 'Not started', value: d.tod.summary.notStarted, color: PALETTE.danger },
          { label: 'In progress', value: d.tod.summary.inProgress, color: PALETTE.navy },
          { label: 'Completed', value: d.tod.summary.completed, color: PALETTE.success },
          { label: 'Overdue', value: d.tod.summary.overdue, color: PALETTE.danger },
          { label: 'Total events', value: d.tod.summary.totalEvents, color: PALETTE.gold },
        ]
      },
      {
        id: 'patrol', label: 'Cameras online', value: d.patrol360.summary.currentActive,
        subLabel: 'Total installed', subValue: d.patrol360.summary.cameraInstalled,
        icon: 'pi-video', accent: '#0f6e56', accentSoft: '#e1f5ee',
        trend: 'up' as const,
        detail: [
          { label: 'Total works', value: d.patrol360.summary.totalWorks, color: PALETTE.navy },
          { label: 'In progress', value: d.patrol360.summary.inProgress, color: PALETTE.navy },
          { label: 'Camera installed', value: d.patrol360.summary.cameraInstalled, color: PALETTE.gold },
          { label: 'Active', value: d.patrol360.summary.currentActive, color: PALETTE.success },
          { label: 'Inactive', value: d.patrol360.summary.currentInactive, color: PALETTE.danger },
        ]
      }
    ]));
  }

  // ── Tender ───────────────────────────────────────────────────
  getTenderSummary(): Observable<TenderSummary> { return this.data$.pipe(map(d => d.tender.summary)); }
  getTenderDivisionCounts(): Observable<TenderDivisionCount[]> { return this.data$.pipe(map(d => d.tender.divisionCounts)); }
  getTenderWorks(division?: string, status?: string, search?: string): Observable<TenderWork[]> {
    return this.data$.pipe(map(d => {
      const works: TenderWork[] = d.tender.divisionCounts.flatMap((dc: any, i: number) =>
        Array.from({ length: Math.min(dc.totalWorks, 5) }, (_, j) => ({
          sno: i * 5 + j + 1, division: dc.division,
          district: dc.division + ' District ' + (j + 1),
          tenderRef: `TAHDCO/${100 + i}/${dc.division.substring(0,3).toUpperCase()}/${dc.division.substring(0,3).toUpperCase()}/${String(j+1).padStart(2,'0')}/2026/WORKS/${String(i*5+j+1).padStart(4,'0')}`,
          workType: 'General Works', contractorName: `Contractor ${i + 1}`,
          awardedDate: '01-03-2026', amount: Math.floor(Math.random() * 50 + 10),
          status: j === 0 ? 'Not-Started' : j === 1 ? 'Slow-Progress' : 'In-Progress' as any
        }))
      );
      let filtered = works;
      if (division && division !== 'All Divisions') filtered = filtered.filter(w => w.division === division);
      if (status) filtered = filtered.filter(w => w.status === status);
      if (search) filtered = filtered.filter(w => w.tenderRef.toLowerCase().includes(search.toLowerCase()) || w.division.toLowerCase().includes(search.toLowerCase()));
      return filtered.slice(0, 50);
    }));
  }

  // ── Housing ──────────────────────────────────────────────────
  getHousingOverall(): Observable<HousingOverall> { return this.data$.pipe(map(d => d.housing.overall)); }
  getHousingDistricts(division?: string, phase?: string): Observable<HousingDistrict[]> {
    return this.data$.pipe(map(d => {
      let rows: HousingDistrict[] = d.housing.districts;
      if (division && division !== 'All Divisions') rows = rows.filter((r: any) => r.division === division);
      if (phase && phase !== 'All Phases') rows = rows.filter((r: any) => r.phase === phase.replace(' ', ''));
      return rows;
    }));
  }

  // ── Scheme ───────────────────────────────────────────────────
  getSchemes(project?: string, search?: string): Observable<SchemeItem[]> {
    return this.data$.pipe(map(d => {
      let rows: SchemeItem[] = d.schemes;
      if (project && project !== 'All Projects') rows = rows.filter((r: any) => r.project === project);
      if (search) rows = rows.filter((r: any) => r.subScheme.toLowerCase().includes(search.toLowerCase()) || r.scheme.toLowerCase().includes(search.toLowerCase()));
      return rows;
    }));
  }
  getSchemeDistrictBreakdown(schemeId: number): Observable<SchemeDistrictBreakdown[]> {
    return this.data$.pipe(map(d => {
      const scheme = d.schemes.find((s: any) => s.sno === schemeId);
      if (!scheme) return [];
      return Object.entries(d.meta.districtsByDivision).flatMap(([div, districts]) =>
        (districts as string[]).map(dist => ({
          district: dist, division: div,
          apply: Math.floor(scheme.apply / 38 + Math.random() * 5),
          dmPending: Math.floor(scheme.dmPending / 38 + Math.random() * 2),
          hqPending: Math.floor(scheme.hqPending / 38 + Math.random() * 2),
          paymentPending: Math.floor(scheme.paymentPending / 38 + Math.random() * 1),
        }))
      );
    }));
  }

  getTelpLoanDatabase(fy?: string, division?: string, district?: string, search?: string): Observable<any[]> {
    return this.data$.pipe(map(d => {
      const divisionsMap: Record<string, string[]> = {
        'Chennai': ['Chengalpattu', 'Kancheepuram', 'Tiruvallur', 'Ranipet'],
        'Coimbatore': ['Coimbatore', 'Erode', 'Tiruppur', 'The Nilgiris'],
        'Madurai': ['Madurai', 'Dindigul', 'Theni', 'Sivagangai', 'Ramanathapuram'],
        'Salem': ['Salem', 'Dharmapuri', 'Krishnagiri', 'Namakkal', 'Karur'],
        'Thanjavur': ['Thanjavur', 'Thiruvarur', 'Nagapattinam', 'Mayiladuthurai'],
        'Trichy': ['Ariyalur', 'Perambalur', 'Thiruchirappalli', 'Pudukkottai'],
        'Vellore': ['Vellore', 'Tirupathur', 'Tiruvannamalai'],
        'Villupuram': ['Villupuram', 'Cuddalore', 'Kallakurichi']
      };

      const courseList = [
        'B.E. Computer Science & Engg', 'MBBS Medical Course', 'M.S. Data Science & AI',
        'B.Tech Mechanical Engg', 'B.Sc Nursing & Allied Health', 'MBA International Business',
        'B.Pharm Pharmacy Studies', 'B.E. Electrical & Electronics'
      ];
      const placesList = ['In-State (Tamil Nadu)', 'Other States in India', 'Abroad / Foreign University'];
      const monthsList = ['July 2026', 'June 2026', 'May 2026', 'April 2026', 'March 2026'];
      const schemeTypes = [
        { code: 'SCH-TELP-01', name: 'Higher Education Loan Scheme' },
        { code: 'SCH-TELP-02', name: 'Foreign Higher Education Special Grant' },
        { code: 'SCH-TELP-03', name: 'Vocational Skill Training Assistance' }
      ];

      const rows: any[] = [];
      let idx = 1;
      const targetFY = fy && fy !== 'All Years' ? fy : 'FY 2025-26';

      Object.entries(divisionsMap).forEach(([divName, dists]) => {
        dists.forEach(distName => {
          schemeTypes.forEach((sch, sIdx) => {
            const apply = Math.floor(100 + (idx * 17) % 250);
            const pending = Math.floor(5 + (idx * 3) % 20);
            const completed = Math.max(0, apply - pending);
            
            rows.push({
              sno: idx,
              financialYear: targetFY,
              division: divName,
              district: distName,
              scheme: sch.code,
              schemeName: sch.name,
              courseName: courseList[(idx + sIdx) % courseList.length],
              placeOfStudy: placesList[(idx + sIdx) % placesList.length],
              noOfSchemeApply: apply,
              paymentPending: pending,
              paymentCompleted: completed,
              sanctionedMonth: monthsList[(idx + sIdx) % monthsList.length]
            });
            idx++;
          });
        });
      });

      let filtered = rows;
      if (division && division !== 'All Divisions') filtered = filtered.filter(r => r.division === division);
      if (district && district !== 'All Districts') filtered = filtered.filter(r => r.district === district);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(r => 
          r.district.toLowerCase().includes(q) || 
          r.division.toLowerCase().includes(q) || 
          r.schemeName.toLowerCase().includes(q) || 
          r.courseName.toLowerCase().includes(q) ||
          r.placeOfStudy.toLowerCase().includes(q)
        );
      }
      return filtered;
    }));
  }

  // ── Enrollment ────────────────────────────────────────────────
  getEnrollSummary(): Observable<EnrollSummary> { return this.data$.pipe(map(d => d.enrollment.summary)); }
  getEnrollDistricts(): Observable<EnrollDistrict[]> { return this.data$.pipe(map(d => d.enrollment.districtData)); }
  getMonthlyCompletion(): Observable<MonthlyCompletion[]> { return this.data$.pipe(map(d => d.enrollment.monthlyCompletion)); }

  // ── TOD ──────────────────────────────────────────────────────
  getTodSummary(): Observable<TodSummary> { return this.data$.pipe(map(d => d.tod.summary)); }
  getTodDistricts(): Observable<TodDistrict[]> { return this.data$.pipe(map(d => d.tod.districtData)); }

  // ── Patrol360 ─────────────────────────────────────────────────
  getPatrolSummary(): Observable<PatrolSummary> { return this.data$.pipe(map(d => d.patrol360.summary)); }
  getPatrolDistricts(): Observable<PatrolDistrict[]> { return this.data$.pipe(map(d => d.patrol360.districtData)); }
  getOfflineDuration(): Observable<OfflineDuration> { return this.data$.pipe(map(d => d.patrol360.offlineDuration)); }

  // ── Detail arrays for module pages (real data from workbook) ──
  getTenderDistricts(division?: string, search?: string): Observable<any[]> {
    return this.data$.pipe(map(d => this.applyFilters(d.tender.districtCounts, division, search)));
  }
  getHousingDivisionSummary(): Observable<any[]> { return this.data$.pipe(map(d => d.housing.divisionSummary)); }

  getThmsBenList(district: string, status?: string, groupmilestone?: string): Observable<any> {
    if (!this.isBackendOnline || !environment.apiUrl) return of({ status: true, data: [] });
    const url = `${environment.apiUrl}/api/v1/dashboard/housing/benlist`;
    return this.http.post<any>(url, { district, status, groupmilestone: groupmilestone }).pipe(
      catchError((err) => {
        this.checkBackendFailure(err);
        return of({ status: true, data: [] });
      })
    );
  }

  getTamsBenList(district: string, status?: string): Observable<any> {
    if (!this.isBackendOnline || !environment.apiUrl) return of({ status: true, data: [] });
    const url = `${environment.apiUrl}/api/v1/dashboard/tams/benlist`;
    return this.http.post<any>(url, { district, status }).pipe(
      catchError((err) => {
        this.checkBackendFailure(err);
        return of({ status: true, data: [] });
      })
    );
  }

  getOneDashboardWorkList(type: string, districtNames: string[], statusNames: string[], years: string[], cameraStatus?: string, divisionName?: string): Observable<any> {
    if (!this.isBackendOnline || !environment.apiUrl) return of({ status: 'SUCCESS', data: [] });
    const url = `${environment.apiUrl}/api/v1/dashboard/tips-time/worklist`;
    return this.http.post<any>(url, { type, districtNames, statusNames, years, cameraStatus, divisionName: divisionName ? [divisionName] : [] }).pipe(
      catchError((err) => {
        this.checkBackendFailure(err);
        return of({ status: 'SUCCESS', data: [] });
      })
    );
  }

  getPatrolCameraStatus(divisionIds: string[], districtIds: string[], contractorId: string, departmentIds: string[], years: string[], selectionType: string, costOrCount: string): Observable<any> {
    if (!this.isBackendOnline || !environment.apiUrl) return of({ status: 'SUCCESS', data: [] });
    const url = `${environment.apiUrl}/api/v1/dashboard/patrol/camera-status`;
    return this.http.post<any>(url, { divisionIds, districtIds, contractorId, departmentIds, years, selectionType, costOrCount }).pipe(
      catchError((err) => {
        this.checkBackendFailure(err);
        return of({ status: 'SUCCESS', data: [] });
      })
    );
  }

  // fromYear/toYear/schemeIds/districtIds are optional — the backend defaults them to the
  // exact values confirmed working in Postman (fromYear 2023, toYear 2027, schemeIds/
  // districtIds ['']) if omitted, so this keeps working with no args but callers can override.
  getTelpApplicationSummary(fromYear?: number, toYear?: number, schemeIds?: string[], districtIds?: string[]): Observable<any> {
    if (!this.isBackendOnline || !environment.apiUrl) return of({ status: 'SUCCESS', data: [] });
    const url = `${environment.apiUrl}/api/v1/dashboard/telp/summary`;
    return this.http.post<any>(url, { fromYear, toYear, schemeIds, districtIds }).pipe(
      catchError((err) => {
        this.checkBackendFailure(err);
        return of({ status: 'ERROR', data: [] });
      })
    );
  }

  // categoryType MUST be the real metric field name returned by getTelpApplicationSummary for
  // the column that was clicked (e.g. "statusSavedCount" for Applied) — the upstream API does
  // not recognize a placeholder like "TotalApplications" and silently returns no matching rows.
  getTelpApplicationDetail(district: string, categoryType: string, fromYear?: number, toYear?: number): Observable<any> {
    if (!this.isBackendOnline || !environment.apiUrl) return of({ status: 'SUCCESS', data: [] });
    const url = `${environment.apiUrl}/api/v1/dashboard/telp/detail`;
    return this.http.post<any>(url, { district, categoryType, fromYear, toYear }).pipe(
      catchError((err) => {
        this.checkBackendFailure(err);
        return of({ status: 'SUCCESS', data: [] });
      })
    );
  }

  getTncwwbGeneral(type: string = 'MEMBER', mode: string = 'LIST', status: string = '', year: string = '2026'): Observable<any> {
    if (!this.isBackendOnline || !environment.apiUrl) return of({ status: 'SUCCESS', data: [] });
    const baseUrl = `${environment.apiUrl}/api/v1/dashboard/tncwwb/general`;
    return this.http.get<any>(`${baseUrl}?type=${encodeURIComponent(type)}&mode=${encodeURIComponent(mode)}&status=${encodeURIComponent(status)}&year=${encodeURIComponent(year)}`).pipe(
      catchError((err) => {
        this.checkBackendFailure(err);
        return of({ status: 'SUCCESS', data: [] });
      })
    );
  }

  getTahdcoSchemeDetail(districtId: string, statusFilter: string): Observable<any> {
    if (!this.isBackendOnline || !environment.apiUrl) return of({ status: 'SUCCESS', data: [] });
    const url = `${environment.apiUrl}/api/v1/dashboard/tahdco-scheme/detail`;
    return this.http.post<any>(url, { districtId, statusFilter }).pipe(
      catchError((err) => {
        this.checkBackendFailure(err);
        return of({ status: 'SUCCESS', data: [] });
      })
    );
  }

  getAiSummary(language: string = 'en', programId: string = 'all', district: string = 'All Districts'): Observable<any> {
    const url = environment.apiUrl ? `${environment.apiUrl}/api/v1/dashboard/ai-summary` : '/api/v1/dashboard/ai-summary';
    return this.http.post<any>(url, { language, programId, district }).pipe(
      catchError(() => of({ status: 'ERROR', textSummary: '', audioBase64: '' }))
    );
  }

  /** Notifications list with project, frequency, status & search parameters */
  getNotifications(project: string = '', frequency: string = '', status: string = '', search: string = ''): Observable<any[]> {
    const baseUrl = environment.apiUrl ? `${environment.apiUrl}/api/v1/notifications` : '/api/v1/notifications';
    const params: string[] = [];
    if (project) params.push(`project=${encodeURIComponent(project)}`);
    if (frequency) params.push(`frequency=${encodeURIComponent(frequency)}`);
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    const qStr = params.length ? '?' + params.join('&') : '';

    return this.http.get<any[]>(`${baseUrl}${qStr}`).pipe(
      catchError(() => of([
        { notificationId: '1', project: 'TIPS TIME', frequency: 'Daily', status: 'In Progress', subject: 'Daily Tender Inspection Alert', message: '3 tender inspections scheduled for today in Chennai division.', sentAt: '10 mins ago', isRead: false },
        { notificationId: '2', project: 'THMS', frequency: 'Weekly', status: 'Pending Approval', subject: 'Weekly THMS Housing Sanction', message: '14 housing beneficiary applications pending DM approval in Coimbatore.', sentAt: '1 hour ago', isRead: false },
        { notificationId: '3', project: 'TELP', frequency: 'Monthly', status: 'Completed', subject: 'Monthly TELP Education Disbursement', message: 'Monthly disbursement of Rs 4.5 Lakhs completed for Madurai applicants.', sentAt: '3 hours ago', isRead: true },
        { notificationId: '4', project: 'TNCWWB', frequency: 'Quarterly', status: 'In Progress', subject: 'TNCWWB Quarterly Member Renewal Audit', message: 'Quarterly member renewal count updated: 1,809 registered members verified.', sentAt: '5 hours ago', isRead: false },
        { notificationId: '5', project: 'TAMS', frequency: 'Daily', status: 'Started', subject: 'Daily Institute Attendance Report', message: '98.4% trainee attendance logged across all government ITI centers today.', sentAt: 'Yesterday', isRead: true },
        { notificationId: '6', project: 'TOD', frequency: 'Weekly', status: 'Not Started', subject: 'Weekly Task Milestone Assignment', message: '2 executive diary review tasks assigned for Trichy & Salem divisions.', sentAt: '2 days ago', isRead: false },
        { notificationId: '7', project: 'Patrol360', frequency: 'Half-Yearly', status: 'Completed', subject: 'Half-Yearly CCTV Camera Maintenance', message: 'All 142 CCTV monitoring cameras audited with zero active downtime.', sentAt: '3 days ago', isRead: true },
        { notificationId: '8', project: 'TIPS TIME', frequency: 'Yearly', status: 'Overdue', subject: 'Yearly Contractor Performance Audit', message: 'Annual contractor rating review due for 4 slow-progress work orders.', sentAt: '4 days ago', isRead: false },
        { notificationId: '9', project: 'TNCWWB', frequency: 'Monthly', status: 'Pending Approval', subject: 'TNCWWB Scheme Assistance Payouts', message: '12 maternity & marriage assistance claims awaiting district verification.', sentAt: '5 days ago', isRead: false },
      ]))
    );
  }

  /** Phase-level THMS rows (real API grain) with division/district/phase/search filters. */
  getHousingRows(division?: string, district?: string, phase?: string, search?: string): Observable<any[]> {
    return this.data$.pipe(map(d => {
      let rows: any[] = d.housing?.rows ?? [];
      if (division && division !== 'All Divisions') rows = rows.filter(r => r.division === division);
      if (district && district !== 'All Districts') rows = rows.filter(r => r.district === district);
      if (phase && phase !== 'All Phases') rows = rows.filter(r => r.phase === phase);
      const q = (search || '').trim().toLowerCase();
      if (q) rows = rows.filter(r =>
        (r.district || '').toLowerCase().includes(q) ||
        (r.division || '').toLowerCase().includes(q) ||
        (r.phase || '').toLowerCase().includes(q));
      return rows;
    }));
  }

  /** Distinct district names present in THMS data (optionally within a division). */
  getHousingDistrictNames(division?: string): Observable<string[]> {
    return this.data$.pipe(map(d => {
      let rows: any[] = d.housing?.rows ?? [];
      if (division && division !== 'All Divisions') rows = rows.filter(r => r.division === division);
      return Array.from(new Set(rows.map(r => r.district as string))).sort();
    }));
  }

  getHousingMilestones(): Observable<any> { return this.data$.pipe(map(d => d.housing?.milestones ?? {})); }
  getHousingStatusSummary(): Observable<any> { return this.data$.pipe(map(d => d.housing?.statusSummary ?? {})); }
  getHousingInfrastructure(): Observable<any> { return this.data$.pipe(map(d => d.housing?.infrastructure ?? {})); }
  getHousingLastMonth(): Observable<any> { return this.data$.pipe(map(d => d.housing?.lastMonthProgress ?? {})); }
  getEnrollInstitutes(division?: string, search?: string): Observable<any[]> {
    return this.data$.pipe(map(d => this.applyFilters(d.enrollment.institutes, division, search, ['institute', 'course'])));
  }
  getEnrollDivisionSummary(): Observable<any[]> { return this.data$.pipe(map(d => d.enrollment.divisionSummary)); }
  getGradeDistribution(): Observable<any> { return this.data$.pipe(map(d => d.enrollment.gradeDistribution)); }
  getMemberSummary(): Observable<any> { return this.data$.pipe(map(d => d.onePortal.memberSummary)); }
  getMemberDistricts(division?: string, search?: string): Observable<any[]> {
    return this.data$.pipe(map(d => this.applyFilters(d.onePortal.memberDistricts, division, search)));
  }
  getSchemeSummary(): Observable<any> { return this.data$.pipe(map(d => d.onePortal.schemeSummary)); }
  getTelpAgencies(): Observable<any[]> { return this.data$.pipe(map(d => d.telp.agencies)); }

  /** shared division + free-text filter for district/institute rows */
  private applyFilters(rows: any[], division?: string, search?: string,
                       searchKeys: string[] = ['district', 'division']): any[] {
    let out = rows || [];
    if (division && division !== 'All Divisions') out = out.filter(r => r.division === division);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(r => searchKeys.some(k => (r[k] || '').toString().toLowerCase().includes(q)));
    }
    return out;
  }

  // ── Unified overview landing tiles (all 9 modules) ────────────
  getOverviewTiles(): Observable<ModuleTile[]> {
    return this.data$.pipe(map(d => {
      const t   = d?.tender?.summary   ?? {};
      const h   = d?.housing?.overall  ?? {};
      const e   = d?.enrollment?.summary ?? {};
      const s   = (d?.schemes as any[]) ?? [];
      const od  = d?.tod?.summary      ?? {};
      const p   = d?.patrol360?.summary ?? {};
      const opm = d?.onePortal?.memberSummary ?? {};
      const ops = d?.onePortal?.schemeSummary ?? {};

      const schemeApply = s.filter(x => x.project === 'TAHDCO Scheme').reduce((a, x) => a + x.apply, 0);
      const telpApply   = s.filter(x => x.project === 'TELP').reduce((a, x) => a + x.apply, 0);

      const tiles: ModuleTile[] = [
        {
          id: 'tender', code: 'TIPS', name: 'Tender Integrated Process System', route: '/tender', app: 'TIPS',
          icon: 'pi-file-edit', accent: '#0a1628', accentSoft: '#e8edf5',
          primaryValue: t.totalWorks ?? 0, primaryLabel: 'Total works',
          stats: [
            { label: 'In progress', value: t.inProgress   ?? 0, tone: 'ok' },
            { label: 'Slow',        value: t.slowProgress ?? 0, tone: 'warn' },
            { label: 'Not started', value: t.notStarted   ?? 0, tone: 'bad' },
          ]
        },
        {
          id: 'housing', code: 'THMS', name: 'Housing Management System', route: '/housing', app: 'THMS',
          icon: 'pi-building', accent: '#1e7c4c', accentSoft: '#edf7f2',
          primaryValue: h.totalHouses ?? 0, primaryLabel: 'Total houses',
          stats: [
            { label: 'Completed',   value: h.completed  ?? 0, tone: 'ok' },
            { label: 'Started',     value: h.started    ?? 0, tone: 'warn' },
            { label: 'Not started', value: h.notStarted ?? 0, tone: 'bad' },
          ]
        },
        {
          id: 'enrollment', code: 'TAMS', name: 'Attendance Management System', route: '/enrollment', app: 'TAMS',
          icon: 'pi-graduation-cap', accent: '#1a5fa5', accentSoft: '#eaf2fb',
          primaryValue: e.totalStudents ?? 0, primaryLabel: 'Total students',
          stats: [
            { label: 'Courses',    value: e.totalCourses   ?? 0, tone: 'neutral' },
            { label: 'Institutes', value: e.totalInstitutes ?? 0, tone: 'neutral' },
            { label: 'New',        value: e.newEnrollment  ?? 0, tone: 'ok' },
          ]
        },
        {
          id: 'scheme', code: 'Scheme', name: 'Scheme Management', route: '/scheme-report', app: 'Scheme',
          icon: 'pi-wallet', accent: '#c9a227', accentSoft: '#fdf8e8',
          primaryValue: schemeApply, primaryLabel: 'Applications',
          stats: [
            { label: 'DM pending',  value: s.reduce((a, x) => a + (x.dmPending      ?? 0), 0), tone: 'warn' },
            { label: 'HQ pending',  value: s.reduce((a, x) => a + (x.hqPending      ?? 0), 0), tone: 'warn' },
            { label: 'Pay pending', value: s.reduce((a, x) => a + (x.paymentPending  ?? 0), 0), tone: 'bad' },
          ]
        },
        {
          id: 'telp', code: 'TELP', name: 'Educational Loan Portal', route: '/scheme-report', app: 'TELP',
          icon: 'pi-book', accent: '#534ab7', accentSoft: '#eeedfe',
          primaryValue: telpApply, primaryLabel: 'Loan applications',
          stats: (d?.telp?.agencies || []).map((a: any) => ({ label: a.agency, value: a.apply ?? 0, tone: 'neutral' as const }))
        },
        {
          id: 'oneportal', code: 'One Portal', name: 'One Portal — Member & Scheme', route: '/scheme-report', app: 'OnePortal',
          icon: 'pi-id-card', accent: '#0f6e56', accentSoft: '#e1f5ee',
          primaryValue: opm.totalWorks ?? 0, primaryLabel: 'Total members',
          stats: [
            { label: 'Card issued',   value: opm.cardIssued  ?? 0, tone: 'ok' },
            { label: 'DM pending',    value: opm.dmPending   ?? 0, tone: 'warn' },
            { label: 'Applications',  value: ops.totalApply  ?? 0, tone: 'neutral' },
          ]
        },
        {
          id: 'tod', code: 'TOD', name: 'Online Diary Portal', route: '/tod', app: 'TOD',
          icon: 'pi-calendar', accent: '#c47a0a', accentSoft: '#fef8e7',
          primaryValue: od.totalTasks ?? 0, primaryLabel: 'Total tasks',
          stats: [
            { label: 'Completed',   value: od.completed  ?? 0, tone: 'ok' },
            { label: 'In progress', value: od.inProgress ?? 0, tone: 'warn' },
            { label: 'Overdue',     value: od.overdue    ?? 0, tone: 'bad' },
          ]
        },
        {
          id: 'time', code: 'TIME', name: 'Tender Monitoring & Evaluation', route: '/tender', app: 'TIME',
          icon: 'pi-clipboard', accent: '#1a3461', accentSoft: '#e8edf5',
          primaryValue: t.mBookTotal ?? 0, primaryLabel: 'M-Books',
          stats: [
            { label: 'Uploaded', value: t.mBookUploaded ?? 0, tone: 'ok' },
            { label: 'No action', value: t.noAction     ?? 0, tone: 'warn' },
            { label: 'Pending',   value: t.mBookPending ?? 0, tone: 'bad' },
          ]
        },
        {
          id: 'patrol', code: 'Patrol 360', name: 'CCTV & Monitoring System', route: '/patrol360', app: 'Patrol360',
          icon: 'pi-video', accent: '#a32d2d', accentSoft: '#fcebeb',
          primaryValue: p.currentActive ?? 0, primaryLabel: 'Cameras online',
          stats: [
            { label: 'Installed', value: p.cameraInstalled  ?? 0, tone: 'neutral' },
            { label: 'Active',    value: p.currentActive    ?? 0, tone: 'ok' },
            { label: 'Inactive',  value: p.currentInactive  ?? 0, tone: 'bad' },
          ]
        },
      ];
      return tiles;
    }));
  }

  // ── Generic drill-down data (one config per module) ───────────
  getDrillData(moduleId: string): Observable<DrillConfig> {
    return this.data$.pipe(map(d => {
      const P = PALETTE;
      switch (moduleId) {
        case 'tender':
        case 'time': {
          const rows: DrillRow[] = d.tender.divisionCounts.map((c: any) => {
            const tot = c.totalWorks || 0;
            let inProg = c.inProgress || 0;
            let notSt = c.notStarted || 0;
            let comp = c.completed || 0;
            const segSum = inProg + notSt + comp;
            if (segSum < tot) {
              const diff = tot - segSum;
              inProg += diff;
            }
            return {
              key: c.division, label: c.division, value: tot,
              segments: [
                { label: 'In progress', value: inProg, color: '#10b981' },
                { label: 'Not started', value: notSt, color: '#ef4444' },
                { label: 'Completed', value: comp, color: '#1e3a8a' },
              ],
              extra: { 'Total works': tot, 'In progress': inProg, 'Not started': notSt, 'Completed': comp, 'M-Books': c.mBooks || 0 }
            };
          });
          return { moduleId, moduleName: 'Tender Integrated Process System', moduleCode: 'TIPS',
            accent: '#0f2042', accentSoft: '#e2e8f0', icon: 'pi-file-edit', valueLabel: 'Total works',
            segmentLegend: [ { label: 'In progress', color: '#10b981' }, { label: 'Not started', color: '#ef4444' }, { label: 'Completed', color: '#1e3a8a' } ],
            rows };
        }
        case 'housing': {
          const rows: DrillRow[] = d.housing.districts.map((h: any) => ({
            key: h.district, label: h.district, value: h.totalHouses,
            segments: [
              { label: 'Completed', value: h.completed, color: P.success },
              { label: 'Started', value: h.started, color: P.warning },
              { label: 'Not started', value: h.notStarted, color: P.danger },
            ],
            extra: { Division: h.division, Phase: h.phase, 'Total houses': h.totalHouses, Completed: h.completed, 'Grade beam': h.gradBeam, Basement: h.basement, 'Lintel level': h.lintelLevel, 'Roof level': h.roofLevel }
          }));
          return { moduleId, moduleName: 'Housing Management System', moduleCode: 'THMS',
            accent: P.success, accentSoft: P.successSoft, icon: 'pi-building', valueLabel: 'Total houses',
            segmentLegend: [ { label: 'Completed', color: P.success }, { label: 'Started', color: P.warning }, { label: 'Not started', color: P.danger } ],
            rows };
        }
        case 'enrollment': {
          const rows: DrillRow[] = d.enrollment.districtData.map((e: any) => ({
            key: e.district, label: e.district, value: e.total,
            segments: [
              { label: 'Completed', value: e.completed, color: P.success },
              { label: 'Ongoing', value: e.ongoing, color: P.warning },
            ],
            extra: { 'Total enrolled': e.total, Completed: e.completed, Ongoing: e.ongoing }
          }));
          return { moduleId, moduleName: 'Attendance Management System', moduleCode: 'TAMS',
            accent: P.info, accentSoft: P.infoSoft, icon: 'pi-graduation-cap', valueLabel: 'Total students',
            segmentLegend: [ { label: 'Completed', color: P.success }, { label: 'Ongoing', color: P.warning } ],
            rows };
        }
        case 'scheme':
        case 'telp':
        case 'oneportal': {
          const byScheme: Record<string, any> = {};
          (d.schemes as any[]).forEach(s => {
            if (!byScheme[s.scheme]) byScheme[s.scheme] = { apply: 0, dm: 0, hq: 0, pay: 0, project: s.project };
            byScheme[s.scheme].apply += s.apply; byScheme[s.scheme].dm += s.dmPending;
            byScheme[s.scheme].hq += s.hqPending; byScheme[s.scheme].pay += s.paymentPending;
          });
          const rows: DrillRow[] = Object.entries(byScheme).map(([name, v]: [string, any]) => ({
            key: name, label: name, value: v.apply,
            segments: [
              { label: 'Approved', value: Math.max(0, v.apply - v.dm - v.hq - v.pay), color: P.success },
              { label: 'DM pending', value: v.dm, color: P.warning },
              { label: 'HQ pending', value: v.hq, color: P.info },
              { label: 'Pay pending', value: v.pay, color: P.danger },
            ],
            extra: { Project: v.project, Applications: v.apply, 'DM pending': v.dm, 'HQ pending': v.hq, 'Payment pending': v.pay }
          }));
          return { moduleId, moduleName: 'Scheme Management', moduleCode: 'Scheme',
            accent: P.gold, accentSoft: P.goldSoft, icon: 'pi-wallet', valueLabel: 'Applications',
            segmentLegend: [ { label: 'Approved', color: P.success }, { label: 'DM pending', color: P.warning }, { label: 'HQ pending', color: P.info }, { label: 'Pay pending', color: P.danger } ],
            rows };
        }
        case 'tod': {
          const rows: DrillRow[] = d.tod.districtData.map((t: any) => ({
            key: t.district + '-' + t.taskType, label: t.district + ' · ' + t.taskType, value: t.taskCount,
            segments: [
              { label: 'Completed', value: t.completed, color: P.success },
              { label: 'In progress', value: t.inProgress, color: P.warning },
              { label: 'Not started', value: t.notStarted, color: P.gray400 },
              { label: 'Overdue', value: t.overdue, color: P.danger },
            ],
            extra: { 'Task type': t.taskType, 'Task count': t.taskCount, Completed: t.completed, 'In progress': t.inProgress, Overdue: t.overdue }
          }));
          return { moduleId, moduleName: 'Online Diary Portal', moduleCode: 'TOD',
            accent: P.warning, accentSoft: P.warningSoft, icon: 'pi-calendar', valueLabel: 'Total tasks',
            segmentLegend: [ { label: 'Completed', color: P.success }, { label: 'In progress', color: P.warning }, { label: 'Not started', color: P.gray400 }, { label: 'Overdue', color: P.danger } ],
            rows };
        }
        case 'patrol':
        default: {
          const rows: DrillRow[] = d.patrol360.districtData.map((p: any) => ({
            key: p.district, label: p.district, value: p.cameraInstalled,
            segments: [
              { label: 'Active', value: p.currentActive, color: P.success },
              { label: 'Inactive', value: p.currentInactive, color: P.danger },
            ],
            extra: { Division: p.division, 'Total works': p.totalWorks, 'Cameras installed': p.cameraInstalled, Active: p.currentActive, Inactive: p.currentInactive }
          }));
          return { moduleId: 'patrol', moduleName: 'CCTV & Monitoring System', moduleCode: 'Patrol 360',
            accent: '#a32d2d', accentSoft: '#fcebeb', icon: 'pi-video', valueLabel: 'Cameras installed',
            segmentLegend: [ { label: 'Active', color: P.success }, { label: 'Inactive', color: P.danger } ],
            rows };
        }
      }
    }));
  }

  // ── AI & RAG Module API Integrations ──
  processAiChat(request: any): Observable<any> {
    const url = `${environment.apiUrl || 'http://localhost:5000'}/api/v1/ai/chat`;
    return this.http.post<any>(url, request).pipe(
      catchError(() => of({
        answer: '### TAHDCO Copilot (AI Engine Active)\n\nProcessed query: ' + request.userQuery + '\n\nActive FY: ' + request.financialYear + '. All 9 administrative verticals (TIPS, THMS, TAMS, Schemes, Patrol360, TOD) are operating within target SLA parameters.',
        providerUsed: 'TAHDCO-Native-AI',
        modelUsed: 'tahdco-llm-v1-quantized',
        latencyMs: 140,
        citations: [
          { documentId: 101, documentTitle: 'G.O. Ms 42 Housing Subsidy Guidelines', category: 'GO', excerpt: 'Subsidy rate Rs. 2.25L plain / 2.75L hill area.', relevanceScore: 0.95 }
        ],
        actionSuggestions: ['Generate TIPS PDF Report', 'Check Housing Progress', 'Query Scheme Applications']
      }))
    );
  }

  searchRag(query: string, category: string = 'All'): Observable<any> {
    const url = `${environment.apiUrl || 'http://localhost:5000'}/api/v1/ai/rag/search?query=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`;
    return this.http.get<any>(url).pipe(
      catchError(() => of({
        query: query,
        totalMatches: 2,
        results: [
          { documentId: 101, documentTitle: 'G.O. (Ms) No. 42 Housing Guidelines', category: 'GO', excerpt: 'TAHDCO Housing subsidy allocation details.', relevanceScore: 0.94 },
          { documentId: 102, documentTitle: 'TIPS Civil Works Manual', category: 'TenderNotice', excerpt: 'M-Book submission regulations within 15 days.', relevanceScore: 0.88 }
        ]
      }))
    );
  }

  getMcpTools(): Observable<any[]> {
    const url = `${environment.apiUrl || 'http://localhost:5000'}/api/v1/ai/mcp/tools`;
    return this.http.get<any[]>(url).pipe(
      catchError(() => of([
        { name: 'tahdco_get_district_summary', description: 'Multi-module district scorecard metrics', category: 'Analytics' },
        { name: 'tahdco_query_tender_works', description: 'TIPS tender works and M-Book status', category: 'CivilWorks' },
        { name: 'tahdco_get_housing_progress', description: 'THMS housing phase construction counts', category: 'Housing' },
        { name: 'tahdco_get_scheme_applications', description: 'Welfare scheme application counters', category: 'WelfareSchemes' },
        { name: 'tahdco_generate_pdf_report', description: 'Generate QuestPDF report download link', category: 'Reports' }
      ]))
    );
  }

  executeMcpTool(toolName: string, argumentsJson: string): Observable<any> {
    const url = `${environment.apiUrl || 'http://localhost:5000'}/api/v1/ai/mcp/execute`;
    return this.http.post<any>(url, { toolName, argumentsJson }).pipe(
      catchError(() => of({
        toolName: toolName,
        success: true,
        outputJson: JSON.stringify({ status: 'Executed successfully via MCP Tool Engine', tool: toolName, timestamp: new Date() }),
        executionTimeMs: 120
      }))
    );
  }

  getAiAnalytics(): Observable<any> {
    const url = `${environment.apiUrl || 'http://localhost:5000'}/api/v1/ai/analytics`;
    return this.http.get<any>(url).pipe(
      catchError(() => of({
        totalRequests: 142,
        totalTokens: 84250,
        totalCostUsd: 0.0412,
        averageLatencyMs: 640.5,
        satisfactionRatePct: 96.4,
        requestsByProvider: { 'OpenAI (GPT-4o)': 85, 'Google Gemini 1.5': 35, 'Ollama Local': 22 }
      }))
    );
  }

  triggerIngestionSync(): Observable<any> {
    const url = `${environment.apiUrl || 'http://localhost:5000'}/api/v1/ingestion/sync`;
    return this.http.post<any>(url, {}).pipe(
      catchError(() => of({
        syncBatchId: 'demo-sync-101',
        success: true,
        totalDurationSeconds: 0.048,
        totalRecordsIngested: 852,
        completedAt: new Date(),
        apiStatuses: [
          { projectName: 'TELP', type: 'COUNT', isHealthy: true, recordsFetched: 38, latencyMs: 12 },
          { projectName: 'TELP', type: 'Detail', isHealthy: true, recordsFetched: 292, latencyMs: 18 },
          { projectName: 'Tahdco Scheme', type: 'COUNT', isHealthy: true, recordsFetched: 38, latencyMs: 15 },
          { projectName: 'Tahdco Scheme', type: 'Detail', isHealthy: true, recordsFetched: 312, latencyMs: 22 },
          { projectName: 'TIPS+TIME+Patrol360', type: 'Detail', isHealthy: true, recordsFetched: 154, latencyMs: 28 },
          { projectName: 'THMS', type: 'COUNT', isHealthy: true, recordsFetched: 38, latencyMs: 11 },
          { projectName: 'TAMS', type: 'COUNT', isHealthy: true, recordsFetched: 38, latencyMs: 14 },
          { projectName: 'One Portal', type: 'COUNT', isHealthy: true, recordsFetched: 38, latencyMs: 19 },
          { projectName: 'TOD', type: 'COUNT', isHealthy: true, recordsFetched: 38, latencyMs: 17 }
        ]
      }))
    );
  }

  getIngestionStatus(): Observable<any> {
    const url = `${environment.apiUrl || 'http://localhost:5000'}/api/v1/ingestion/status`;
    return this.http.get<any>(url).pipe(
      catchError(() => this.triggerIngestionSync())
    );
  }

  getIngestionRecords(project?: string, district?: string, status?: string): Observable<any[]> {
    let url = `${environment.apiUrl || 'http://localhost:5000'}/api/v1/ingestion/records?limit=200`;
    if (project) url += `&project=${encodeURIComponent(project)}`;
    if (district) url += `&district=${encodeURIComponent(district)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    return this.http.get<any[]>(url).pipe(
      catchError(() => of([]))
    );
  }

  queryMultiProjectRag(query: string, projectFilter: string = 'All', districtFilter: string = 'All'): Observable<any> {
    const url = `${environment.apiUrl || 'http://localhost:5000'}/api/v1/ingestion/rag-query`;
    return this.http.post<any>(url, { query, projectFilter, districtFilter, topK: 5 }).pipe(
      catchError(() => of({
        query,
        totalMatches: 5,
        aggregatedAnswer: `RAG search retrieved 5 relevant multi-project records across TELP, Scheme, THMS, TAMS, and One Portal for "${query}".`,
        executionTimeMs: 45
      }))
    );
  }

  // ── Multi-Module Dashboard Cache (api/v2/dashboard-cache) ──────────────────
  // Deliberately does NOT follow this file's usual catchError(() => of(<mock data>))
  // pattern. The whole point of this backend feature is that a failure is reported
  // honestly (unavailable: true / a clear message) instead of ever being papered over
  // with fabricated numbers — mirroring that contract here means an HTTP-level failure
  // (network down, CORS, 5xx) must also degrade to an honest "unavailable" result, not
  // a fake "success" one like the rest of this service returns for demo purposes.

  private dashboardCacheBase(): string {
    return environment.apiUrl ? `${environment.apiUrl}/api/v2/dashboard-cache` : '/api/v2/dashboard-cache';
  }

  private unavailableResult<T>(message: string): DashboardCacheResult<T> {
    return { data: null, source: 'NONE', stale: false, unavailable: true, cacheStatus: 'API_FAILED', message };
  }

  /** Server's own list of registered module keys — lets the module-tabs UI stay in sync with
   * DashboardModule.All without duplicating it, while DASHBOARD_MODULES (models/index.ts)
   * supplies the label/icon/app metadata for whichever keys come back. */
  getDashboardModuleKeys(): Observable<DashboardModuleKey[]> {
    return this.http.get<DashboardModuleKey[]>(`${this.dashboardCacheBase()}/modules`).pipe(
      catchError(() => of([]))
    );
  }

  getModuleCount(module: DashboardModuleKey | string, filters: Record<string, any> = {}): Observable<DashboardCacheResult<NormalizedCount[]>> {
    return this.http.post<DashboardCacheResult<NormalizedCount[]>>(`${this.dashboardCacheBase()}/${module}/count`, filters).pipe(
      catchError(() => of(this.unavailableResult<NormalizedCount[]>(`${module} counts are currently unavailable.`)))
    );
  }

  getModuleDetail(module: DashboardModuleKey | string, clickContext: ClickContext): Observable<DashboardCacheResult<NormalizedDetailRecord[]>> {
    return this.http.post<DashboardCacheResult<NormalizedDetailRecord[]>>(`${this.dashboardCacheBase()}/${module}/detail`, clickContext).pipe(
      catchError(() => of(this.unavailableResult<NormalizedDetailRecord[]>('This data is currently unavailable. Please try again shortly.')))
    );
  }

  getModuleDataStatus(module: DashboardModuleKey | string, clickContext: ClickContext): Observable<DashboardDataStatus> {
    return this.http.post<DashboardDataStatus>(`${this.dashboardCacheBase()}/${module}/status`, clickContext).pipe(
      catchError(() => of({ exists: false, fresh: false, stale: false, recordCount: 0 } as DashboardDataStatus))
    );
  }

  getModuleDataSource(module: DashboardModuleKey | string, clickContext: ClickContext): Observable<{ source: string }> {
    return this.http.post<{ source: string }>(`${this.dashboardCacheBase()}/${module}/source`, clickContext).pipe(
      catchError(() => of({ source: 'NONE' }))
    );
  }

  refreshModuleDetail(module: DashboardModuleKey | string, clickContext: ClickContext): Observable<DashboardRefreshResult> {
    return this.http.post<DashboardRefreshResult>(`${this.dashboardCacheBase()}/${module}/refresh`, clickContext).pipe(
      catchError(() => of({ triggered: true, success: false, message: 'Refresh request failed to reach the server.' } as DashboardRefreshResult))
    );
  }
}






