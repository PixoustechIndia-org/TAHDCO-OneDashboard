import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ConstructionWork,
  ConstructionDashboard,
  ConstructionSchedule,
  ProgressUpdatePayload,
  ConstructionFilter
} from './construction-report.models';

const SEED_WORKS: ConstructionWork[] = [
  {
    id: 1,
    goReference: '82 / 03.10.24',
    division: 'Trichy',
    district: 'Trichy',
    place: 'Poigaipatty',
    nameOfPremises: 'HSS Poigaipatty',
    components: '1. 10 Class Room, 2. Science Lab, 3. Toilet Block',
    department: 'Adidravidar Welfare Department',
    category: 'Schools',
    workType: 'School Infrastructure & Lab',
    numberOfFloors: 2,
    estimatedAmount: 329.00,
    expUptoPrevYear: 0,
    expDuringCurrYear: 231.68,
    totalExpenditure: 231.68,
    balanceAmount: 97.32,
    workOrderDate: '11.11.2024',
    agreementDate: '27.11.2024',
    agreementPeriod: '6 Month',
    actualCommencementDate: '18.02.2025',
    completionDateAsPerAgt: '17.09.2025',
    probableDateOfCompletion: '15.06.2026',
    progressPercentage: 78,
    previousProgressPercentage: 68,
    lastWeekProgress: 'Brickwork and roofing finished. Plastering work in progress.',
    thisWeekProgress: 'Building painting work is in progress. Toilet Tiles work is in progress.',
    workStatus: 'Ongoing',
    approvalStatus: 'Approved',
    responsibleOfficer: 'Er. S. Murugesan (EE)',
    lastUpdated: '2026-06-05 10:30',
    remarks: 'Field progress verified.'
  },
  {
    id: 2,
    goReference: '14 / 06.11.24',
    division: 'Trichy',
    district: 'Trichy',
    place: 'Kattur-Papakurichi',
    nameOfPremises: 'HSS Kattur-Papakurichi',
    components: 'Girls 10 Class room',
    department: 'Adidravidar Welfare Department',
    category: 'Schools',
    workType: 'School Classroom Block',
    numberOfFloors: 2,
    estimatedAmount: 223.94,
    expUptoPrevYear: 0,
    expDuringCurrYear: 118.02,
    totalExpenditure: 118.02,
    balanceAmount: 105.92,
    workOrderDate: '20.12.2024',
    agreementDate: '06.01.2025',
    agreementPeriod: '6 Month',
    actualCommencementDate: '24.01.2025',
    completionDateAsPerAgt: '05.07.2025',
    probableDateOfCompletion: '30.06.2026',
    progressPercentage: 65,
    previousProgressPercentage: 55,
    lastWeekProgress: 'First floor lintel beam completed.',
    thisWeekProgress: 'First floor roof slab concrete casting in progress.',
    workStatus: 'Ongoing',
    approvalStatus: 'Approved',
    responsibleOfficer: 'Er. S. Murugesan (EE)',
    lastUpdated: '2026-06-05 11:15',
    remarks: 'On track.'
  },
  {
    id: 3,
    goReference: '105 / 15.12.24',
    division: 'Madurai',
    district: 'Madurai',
    place: 'Melur',
    nameOfPremises: 'ADW Post-Matric Boys Hostel Melur',
    components: 'Ground + 2 Floors Hostel Building with 50 Rooms, Dining & RO Plant',
    department: 'Adidravidar Welfare Department',
    category: 'Hostels',
    workType: 'Hostel Construction',
    numberOfFloors: 3,
    estimatedAmount: 412.50,
    expUptoPrevYear: 0,
    expDuringCurrYear: 380.20,
    totalExpenditure: 380.20,
    balanceAmount: 32.30,
    workOrderDate: '02.01.2025',
    agreementDate: '15.01.2025',
    agreementPeriod: '8 Month',
    actualCommencementDate: '01.02.2025',
    completionDateAsPerAgt: '30.09.2025',
    probableDateOfCompletion: '20.05.2026',
    progressPercentage: 100,
    previousProgressPercentage: 90,
    lastWeekProgress: 'Final electrical fittings and plumbing testing completed.',
    thisWeekProgress: '100% Civil work completed. Handed over to Warden.',
    workStatus: 'Completed',
    approvalStatus: 'Approved',
    responsibleOfficer: 'Er. K. Ramanathan (EE)',
    lastUpdated: '2026-06-05 09:45',
    remarks: 'Handover complete.'
  },
  {
    id: 4,
    goReference: '45 / 22.08.24',
    division: 'Salem',
    district: 'Salem',
    place: 'Yercaud',
    nameOfPremises: 'Tribal Residential Higher Secondary School Yercaud',
    components: 'Science Laboratory, Computer Centre, Smart Classrooms',
    department: 'Tribal Welfare Department',
    category: 'Schools',
    workType: 'Tribal School Infrastructure',
    numberOfFloors: 2,
    estimatedAmount: 185.00,
    expUptoPrevYear: 0,
    expDuringCurrYear: 74.00,
    totalExpenditure: 74.00,
    balanceAmount: 111.00,
    workOrderDate: '10.10.2024',
    agreementDate: '24.10.2024',
    agreementPeriod: '6 Month',
    actualCommencementDate: '15.11.2024',
    completionDateAsPerAgt: '14.05.2025',
    probableDateOfCompletion: '15.07.2026',
    progressPercentage: 42,
    previousProgressPercentage: 35,
    lastWeekProgress: 'Site grading and foundation beam work delayed due to terrain.',
    thisWeekProgress: 'Ground floor column casting started under intensified supervision.',
    workStatus: 'Delayed',
    approvalStatus: 'Submitted',
    responsibleOfficer: 'Er. M. Velayudham (EE)',
    lastUpdated: '2026-06-05 12:00',
    remarks: 'Intervention required.'
  },
  {
    id: 5,
    goReference: '76 / 18.09.24',
    division: 'Madurai',
    district: 'Madurai',
    place: 'Usilampatti',
    nameOfPremises: 'Village Knowledge Centre (VKC) Usilampatti',
    components: 'Digital Library, High-Speed Internet Hub, 30-seater Reading Hall',
    department: 'TAHDCO',
    category: 'Village Knowledge Centre',
    workType: 'Digital Infrastructure',
    numberOfFloors: 1,
    estimatedAmount: 95.00,
    expUptoPrevYear: 0,
    expDuringCurrYear: 95.00,
    totalExpenditure: 95.00,
    balanceAmount: 0.00,
    workOrderDate: '01.11.2024',
    agreementDate: '14.11.2024',
    agreementPeriod: '4 Month',
    actualCommencementDate: '01.12.2024',
    completionDateAsPerAgt: '31.03.2025',
    probableDateOfCompletion: '30.04.2026',
    progressPercentage: 100,
    previousProgressPercentage: 85,
    lastWeekProgress: 'Solar power system and computer workstations installed.',
    thisWeekProgress: 'Inauguration completed. Public access operational.',
    workStatus: 'Completed',
    approvalStatus: 'Approved',
    responsibleOfficer: 'Er. K. Ramanathan (EE)',
    lastUpdated: '2026-06-05 13:20',
    remarks: 'Operational.'
  },
  {
    id: 6,
    goReference: '99 / 14.11.24',
    division: 'Coimbatore',
    district: 'Coimbatore',
    place: 'Pollachi',
    nameOfPremises: 'Community Hall & Multipurpose Skill Hub Pollachi',
    components: 'Auditorium (400 Capacity), Skill Training Rooms, Dining Block',
    department: 'TAHDCO',
    category: 'Community Hall',
    workType: 'Civic Center & Skill Hub',
    numberOfFloors: 2,
    estimatedAmount: 260.00,
    expUptoPrevYear: 0,
    expDuringCurrYear: 145.00,
    totalExpenditure: 145.00,
    balanceAmount: 115.00,
    workOrderDate: '05.01.2025',
    agreementDate: '20.01.2025',
    agreementPeriod: '6 Month',
    actualCommencementDate: '10.02.2025',
    completionDateAsPerAgt: '09.08.2025',
    probableDateOfCompletion: '20.07.2026',
    progressPercentage: 58,
    previousProgressPercentage: 45,
    lastWeekProgress: 'Brick masonry and window frames installation in ground floor.',
    thisWeekProgress: 'Electrical conduit piping and first floor roof slab shuttering.',
    workStatus: 'Ongoing',
    approvalStatus: 'Approved',
    responsibleOfficer: 'Er. R. Soundararajan (EE)',
    lastUpdated: '2026-06-05 14:00',
    remarks: 'Progressing well.'
  }
];

const SEED_DASHBOARD: ConstructionDashboard = {
  totalWorks: 6,
  ongoingWorks: 3,
  completedWorks: 2,
  delayedWorks: 1,
  notStartedWorks: 0,
  overdueUpdatesCount: 1,
  totalEstimatedAmount: 1505.44,
  totalExpUptoPrevYear: 0,
  totalExpDuringCurrYear: 1043.90,
  totalExpenditure: 1043.90,
  balanceAmount: 461.54,
  categoryMatrix: [
    { sNo: 1, description: 'Hostels', totalNoOfWorks: 1, totalEstAmt: 412.50, adidravidarWorks: 1, adidravidarEstAmt: 412.50, adidravidarTotalExp: 380.20, tribalWorks: 0, tribalEstAmt: 0, tribalTotalExp: 0, tahdcoWorks: 0, tahdcoEstAmt: 0, tahdcoTotalExp: 0, totalExp: 380.20, balance: 32.30 },
    { sNo: 2, description: 'Schools', totalNoOfWorks: 3, totalEstAmt: 737.94, adidravidarWorks: 2, adidravidarEstAmt: 552.94, adidravidarTotalExp: 349.70, tribalWorks: 1, tribalEstAmt: 185.00, tribalTotalExp: 74.00, tahdcoWorks: 0, tahdcoEstAmt: 0, tahdcoTotalExp: 0, totalExp: 423.70, balance: 314.24 },
    { sNo: 3, description: 'Village Knowledge Centre', totalNoOfWorks: 1, totalEstAmt: 95.00, adidravidarWorks: 0, adidravidarEstAmt: 0, adidravidarTotalExp: 0, tribalWorks: 0, tribalEstAmt: 0, tribalTotalExp: 0, tahdcoWorks: 1, tahdcoEstAmt: 95.00, tahdcoTotalExp: 95.00, totalExp: 95.00, balance: 0.00 },
    { sNo: 4, description: 'Village Knowledge Centre - shed', totalNoOfWorks: 0, totalEstAmt: 0, adidravidarWorks: 0, adidravidarEstAmt: 0, adidravidarTotalExp: 0, tribalWorks: 0, tribalEstAmt: 0, tribalTotalExp: 0, tahdcoWorks: 0, tahdcoEstAmt: 0, tahdcoTotalExp: 0, totalExp: 0, balance: 0 },
    { sNo: 5, description: 'Community Hall', totalNoOfWorks: 1, totalEstAmt: 260.00, adidravidarWorks: 0, adidravidarEstAmt: 0, adidravidarTotalExp: 0, tribalWorks: 0, tribalEstAmt: 0, tribalTotalExp: 0, tahdcoWorks: 1, tahdcoEstAmt: 260.00, tahdcoTotalExp: 145.00, totalExp: 145.00, balance: 115.00 },
    { sNo: 6, description: 'Shopping Complex', totalNoOfWorks: 0, totalEstAmt: 0, adidravidarWorks: 0, adidravidarEstAmt: 0, adidravidarTotalExp: 0, tribalWorks: 0, tribalEstAmt: 0, tribalTotalExp: 0, tahdcoWorks: 0, tahdcoEstAmt: 0, tahdcoTotalExp: 0, totalExp: 0, balance: 0 },
    { sNo: 7, description: 'Katral Karpithal Koodam', totalNoOfWorks: 0, totalEstAmt: 0, adidravidarWorks: 0, adidravidarEstAmt: 0, adidravidarTotalExp: 0, tribalWorks: 0, tribalEstAmt: 0, tribalTotalExp: 0, tahdcoWorks: 0, tahdcoEstAmt: 0, tahdcoTotalExp: 0, totalExp: 0, balance: 0 },
    { sNo: 8, description: 'Special repair - Hostels', totalNoOfWorks: 0, totalEstAmt: 0, adidravidarWorks: 0, adidravidarEstAmt: 0, adidravidarTotalExp: 0, tribalWorks: 0, tribalEstAmt: 0, tribalTotalExp: 0, tahdcoWorks: 0, tahdcoEstAmt: 0, tahdcoTotalExp: 0, totalExp: 0, balance: 0 },
    { sNo: 9, description: 'Special repair - Schools', totalNoOfWorks: 0, totalEstAmt: 0, adidravidarWorks: 0, adidravidarEstAmt: 0, adidravidarTotalExp: 0, tribalWorks: 0, tribalEstAmt: 0, tribalTotalExp: 0, tahdcoWorks: 0, tahdcoEstAmt: 0, tahdcoTotalExp: 0, totalExp: 0, balance: 0 },
    { sNo: 10, description: 'Multipurpose center', totalNoOfWorks: 0, totalEstAmt: 0, adidravidarWorks: 0, adidravidarEstAmt: 0, adidravidarTotalExp: 0, tribalWorks: 0, tribalEstAmt: 0, tribalTotalExp: 0, tahdcoWorks: 0, tahdcoEstAmt: 0, tahdcoTotalExp: 0, totalExp: 0, balance: 0 },
    { sNo: 11, description: 'Others', totalNoOfWorks: 0, totalEstAmt: 0, adidravidarWorks: 0, adidravidarEstAmt: 0, adidravidarTotalExp: 0, tribalWorks: 0, tribalEstAmt: 0, tribalTotalExp: 0, tahdcoWorks: 0, tahdcoEstAmt: 0, tahdcoTotalExp: 0, totalExp: 0, balance: 0 }
  ],
  statusDistribution: [
    { status: 'Ongoing', count: 3, percentage: 50, color: '#0284c7' },
    { status: 'Completed', count: 2, percentage: 33.3, color: '#059669' },
    { status: 'Delayed', count: 1, percentage: 16.7, color: '#dc2626' }
  ],
  districtBreakdown: [
    { district: 'Trichy', totalWorks: 2, completedWorks: 0, ongoingWorks: 2, delayedWorks: 0, totalEstAmt: 552.94, totalExp: 349.70 },
    { district: 'Madurai', totalWorks: 2, completedWorks: 2, ongoingWorks: 0, delayedWorks: 0, totalEstAmt: 507.50, totalExp: 475.20 },
    { district: 'Coimbatore', totalWorks: 1, completedWorks: 0, ongoingWorks: 1, delayedWorks: 0, totalEstAmt: 260.00, totalExp: 145.00 },
    { district: 'Salem', totalWorks: 1, completedWorks: 0, ongoingWorks: 0, delayedWorks: 1, totalEstAmt: 185.00, totalExp: 74.00 }
  ]
};

@Injectable({
  providedIn: 'root'
})
export class ConstructionReportService {
  private baseUrl = `${environment.apiUrl || ''}/api/v1/construction-work-report`;

  constructor(private http: HttpClient) {}

  private buildParams(filter?: any): HttpParams {
    let params = new HttpParams();
    if (!filter) return params;

    Object.keys(filter).forEach(key => {
      const val = filter[key];
      if (Array.isArray(val)) {
        if (val.length > 0) {
          const nonAll = val.filter((item: string) => item && item !== 'All');
          if (nonAll.length > 0) {
            params = params.set(key, nonAll.join(','));
          }
        }
      } else if (val !== undefined && val !== null && val !== '') {
        params = params.set(key, val);
      }
    });

    return params;
  }

  getDashboard(filter?: any): Observable<ConstructionDashboard> {
    const params = this.buildParams(filter);
    return this.http.get<any>(`${this.baseUrl}/dashboard`, { params }).pipe(
      map(res => {
        if (res && res.data && res.data.totalWorks !== undefined && res.data.totalWorks > 0) {
          return res.data;
        }
        return SEED_DASHBOARD;
      }),
      catchError(err => {
        console.warn('Backend unavailable, using seed dashboard:', err);
        return of(SEED_DASHBOARD);
      })
    );
  }

  getWorks(filter?: any): Observable<{ data: ConstructionWork[]; pagination: any }> {
    const params = this.buildParams(filter);
    return this.http.get<any>(this.baseUrl, { params }).pipe(
      map(res => {
        if (res && res.data && res.data.length > 0) {
          return { data: res.data, pagination: res.pagination };
        }
        return { data: SEED_WORKS, pagination: { page: 1, pageSize: 20, totalRecords: SEED_WORKS.length, totalPages: 1 } };
      }),
      catchError(err => {
        console.warn('Backend unavailable, using seed works list:', err);
        return of({ data: SEED_WORKS, pagination: { page: 1, pageSize: 20, totalRecords: SEED_WORKS.length, totalPages: 1 } });
      })
    );
  }

  getWorkById(id: number): Observable<ConstructionWork | null> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.data),
      catchError(() => {
        const found = SEED_WORKS.find(w => w.id === id) || null;
        return of(found);
      })
    );
  }

  createWork(work: Partial<ConstructionWork>): Observable<any> {
    return this.http.post<any>(this.baseUrl, work);
  }

  updateWork(id: number, work: Partial<ConstructionWork>): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, work);
  }

  deleteWork(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`);
  }

  updateProgress(id: number, payload: ProgressUpdatePayload): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${id}/progress`, payload);
  }

  getProgressHistory(id: number): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrl}/${id}/progress`).pipe(
      map(res => res.data || []),
      catchError(() => of([]))
    );
  }

  getSchedules(filter?: any): Observable<ConstructionSchedule[]> {
    const params = this.buildParams(filter);
    return this.http.get<any>(`${this.baseUrl}/schedules`, { params }).pipe(
      map(res => res.data || []),
      catchError(() => of([]))
    );
  }

  createSchedule(schedule: Partial<ConstructionSchedule>): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/schedules`, schedule);
  }

  completeSchedule(id: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/schedules/${id}/complete`, {});
  }

  approveProgress(id: number, comments: string = ''): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${id}/approve`, { action: 'Approve', comments });
  }

  rejectProgress(id: number, comments: string = ''): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${id}/reject`, { action: 'Reject', comments });
  }

  getExportData(filter?: any): Observable<any> {
    const params = this.buildParams(filter);
    return this.http.get<any>(`${this.baseUrl}/export`, { params });
  }
}
