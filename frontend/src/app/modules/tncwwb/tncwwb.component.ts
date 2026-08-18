import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-tncwwb',
  templateUrl: './tncwwb.component.html',
  styleUrls: ['./tncwwb.component.scss'],
  providers: [MessageService]
})
export class TncwwbComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Filter States
  activeCategory: 'member' | 'scheme' = 'member';
  viewMode: 'count' | 'list' = 'count';
  selectedFY = '2026';
  selectedDistrict = 'All Districts';
  selectedDivision = 'All Divisions';
  selectedStatus = '';
  searchTerm = '';

  fyOptions = [
    { label: '2026', value: '2026' },
    { label: '2025', value: '2025' },
    { label: '2024', value: '2024' }
  ];

  divisionOptions = [
    { label: 'All Divisions', value: 'All Divisions' },
    { label: 'Chennai Division', value: 'Chennai' },
    { label: 'Coimbatore Division', value: 'Coimbatore' },
    { label: 'Madurai Division', value: 'Madurai' },
    { label: 'Tiruchirappalli Division', value: 'Tiruchirappalli' },
    { label: 'Salem Division', value: 'Salem' }
  ];

  districtOptions = [
    { label: 'All Districts', value: 'All Districts' },
    { label: 'Chennai', value: 'Chennai' },
    { label: 'Coimbatore', value: 'Coimbatore' },
    { label: 'Cuddalore', value: 'Cuddalore' },
    { label: 'Erode', value: 'Erode' },
    { label: 'Kancheepuram', value: 'Kancheepuram' },
    { label: 'Madurai', value: 'Madurai' },
    { label: 'Salem', value: 'Salem' },
    { label: 'Thanjavur', value: 'Thanjavur' },
    { label: 'Tiruchirappalli', value: 'Tiruchirappalli' },
    { label: 'Tiruvallur', value: 'Tiruvallur' },
    { label: 'Vellore', value: 'Vellore' },
    { label: 'Villupuram', value: 'Villupuram' }
  ];

  statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Approved', value: 'Approved' },
    { label: 'DM Pending', value: 'DM Pending' },
    { label: 'HQ Pending', value: 'HQ Pending' },
    { label: 'Payment Pending', value: 'Payment Pending' }
  ];

  loading = false;

  // KPI Summary Counts (COUNT mode)
  memberStats = {
    totalMembers: 1809,
    cardIssued: 1642,
    dmPending: 120,
    hqPending: 47,
    maleMembers: 1045,
    femaleMembers: 764
  };

  schemeStats = {
    totalApply: 3042,
    approved: 2680,
    dmPending: 167,
    hqPending: 100,
    paymentPending: 95,
    totalDisbursedAmount: 4280000
  };

  // Detailed Record Lists (LIST mode)
  memberList: any[] = [];
  filteredMemberList: any[] = [];

  schemeList: any[] = [];
  filteredSchemeList: any[] = [];

  first = 0;
  rows = 15;

  constructor(
    public auth: AuthService,
    private ds: DataService,
    private msg: MessageService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Preserve filters from query parameters (Dashboard to Application transition)
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['district']) {
        this.selectedDistrict = params['district'];
      }
      if (params['division']) {
        this.selectedDivision = params['division'];
      }
      if (params['year']) {
        this.selectedFY = params['year'];
      }
      if (params['status']) {
        this.selectedStatus = params['status'];
      }
      if (params['mode']) {
        this.viewMode = params['mode'] === 'list' ? 'list' : 'count';
      }
      if (params['cat']) {
        this.activeCategory = params['cat'] === 'scheme' ? 'scheme' : 'member';
      }
      this.loadData();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setCategory(cat: 'member' | 'scheme'): void {
    this.activeCategory = cat;
    this.updateQueryParams();
    this.applyFilters();
  }

  setViewMode(mode: 'count' | 'list'): void {
    this.viewMode = mode;
    this.updateQueryParams();
  }

  updateQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        district: this.selectedDistrict !== 'All Districts' ? this.selectedDistrict : null,
        division: this.selectedDivision !== 'All Divisions' ? this.selectedDivision : null,
        year: this.selectedFY,
        status: this.selectedStatus || null,
        mode: this.viewMode,
        cat: this.activeCategory
      },
      queryParamsHandling: 'merge'
    });
  }

  loadData(): void {
    this.loading = true;

    // Generate Comprehensive Mock Member Detailed List
    this.memberList = [
      { id: 'MEM-2026-001', name: 'M. Shanmugam', district: 'Chennai', division: 'Chennai', trade: 'Mason', gender: 'Male', status: 'Approved', cardIssued: true, regDate: '2026-01-12' },
      { id: 'MEM-2026-002', name: 'K. Lakshmi', district: 'Coimbatore', division: 'Coimbatore', trade: 'Helper', gender: 'Female', status: 'Approved', cardIssued: true, regDate: '2026-01-14' },
      { id: 'MEM-2026-003', name: 'R. Murugan', district: 'Madurai', division: 'Madurai', trade: 'Carpenter', gender: 'Male', status: 'DM Pending', cardIssued: false, regDate: '2026-01-18' },
      { id: 'MEM-2026-004', name: 'P. Anandhi', district: 'Tiruchirappalli', division: 'Tiruchirappalli', trade: 'Painter', gender: 'Female', status: 'Approved', cardIssued: true, regDate: '2026-01-20' },
      { id: 'MEM-2026-005', name: 'V. Sundaram', district: 'Salem', division: 'Salem', trade: 'Electrician', gender: 'Male', status: 'HQ Pending', cardIssued: false, regDate: '2026-01-22' },
      { id: 'MEM-2026-006', name: 'S. Kavitha', district: 'Tiruvallur', division: 'Chennai', trade: 'Plumber', gender: 'Female', status: 'Approved', cardIssued: true, regDate: '2026-01-25' },
      { id: 'MEM-2026-007', name: 'A. Selvam', district: 'Vellore', division: 'Chennai', trade: 'Mason', gender: 'Male', status: 'DM Pending', cardIssued: false, regDate: '2026-02-01' },
      { id: 'MEM-2026-008', name: 'N. Devaki', district: 'Erode', division: 'Coimbatore', trade: 'Bar Bending', gender: 'Female', status: 'Approved', cardIssued: true, regDate: '2026-02-03' },
      { id: 'MEM-2026-009', name: 'T. Palani', district: 'Thanjavur', division: 'Tiruchirappalli', trade: 'Welder', gender: 'Male', status: 'Approved', cardIssued: true, regDate: '2026-02-05' },
      { id: 'MEM-2026-010', name: 'G. Meenakshi', district: 'Cuddalore', division: 'Salem', trade: 'Mason', gender: 'Female', status: 'Payment Pending', cardIssued: true, regDate: '2026-02-08' },
      { id: 'MEM-2026-011', name: 'C. Raman', district: 'Kancheepuram', division: 'Chennai', trade: 'Electrician', gender: 'Male', status: 'Approved', cardIssued: true, regDate: '2026-02-10' },
      { id: 'MEM-2026-012', name: 'D. Senthamarai', district: 'Villupuram', division: 'Salem', trade: 'Tile Layer', gender: 'Female', status: 'DM Pending', cardIssued: false, regDate: '2026-02-12' }
    ];

    // Generate Comprehensive Mock Scheme Assistance Detailed List
    this.schemeList = [
      { claimNo: 'CLM-2026-101', memberName: 'M. Shanmugam', district: 'Chennai', division: 'Chennai', schemeName: 'Maternity Assistance', amount: 18000, status: 'Approved', appDate: '2026-01-10' },
      { claimNo: 'CLM-2026-102', memberName: 'K. Lakshmi', district: 'Coimbatore', division: 'Coimbatore', schemeName: 'Marriage Assistance', amount: 20000, status: 'Approved', appDate: '2026-01-15' },
      { claimNo: 'CLM-2026-103', memberName: 'R. Murugan', district: 'Madurai', division: 'Madurai', schemeName: 'Educational Scholarship', amount: 8000, status: 'DM Pending', appDate: '2026-01-19' },
      { claimNo: 'CLM-2026-104', memberName: 'P. Anandhi', district: 'Tiruchirappalli', division: 'Tiruchirappalli', schemeName: 'Maternity Assistance', amount: 18000, status: 'Payment Pending', appDate: '2026-01-21' },
      { claimNo: 'CLM-2026-105', memberName: 'V. Sundaram', district: 'Salem', division: 'Salem', schemeName: 'Accidental Disability Ex-Gratia', amount: 50000, status: 'HQ Pending', appDate: '2026-01-24' },
      { claimNo: 'CLM-2026-106', memberName: 'S. Kavitha', district: 'Tiruvallur', division: 'Chennai', schemeName: 'Educational Scholarship', amount: 12000, status: 'Approved', appDate: '2026-01-28' },
      { claimNo: 'CLM-2026-107', memberName: 'A. Selvam', district: 'Vellore', division: 'Chennai', schemeName: 'Funeral Assistance', amount: 10000, status: 'Approved', appDate: '2026-02-02' },
      { claimNo: 'CLM-2026-108', memberName: 'N. Devaki', district: 'Erode', division: 'Coimbatore', schemeName: 'Spectacle Reimbursement', amount: 3000, status: 'Approved', appDate: '2026-02-04' },
      { claimNo: 'CLM-2026-109', memberName: 'T. Palani', district: 'Thanjavur', division: 'Tiruchirappalli', schemeName: 'Natural Death Assistance', amount: 50000, status: 'DM Pending', appDate: '2026-02-07' },
      { claimNo: 'CLM-2026-110', memberName: 'G. Meenakshi', district: 'Cuddalore', division: 'Salem', schemeName: 'Marriage Assistance', amount: 20000, status: 'Payment Pending', appDate: '2026-02-09' }
    ];

    this.applyFilters();
    this.loading = false;
  }

  applyFilters(): void {
    const q = (this.searchTerm || '').trim().toLowerCase();

    // Filter Member List
    this.filteredMemberList = this.memberList.filter(item => {
      const matchDist = this.selectedDistrict === 'All Districts' || item.district === this.selectedDistrict;
      const matchDiv = this.selectedDivision === 'All Divisions' || item.division === this.selectedDivision;
      const matchStatus = !this.selectedStatus || item.status === this.selectedStatus;
      const matchSearch = !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q) || item.trade.toLowerCase().includes(q);
      return matchDist && matchDiv && matchStatus && matchSearch;
    });

    // Filter Scheme List
    this.filteredSchemeList = this.schemeList.filter(item => {
      const matchDist = this.selectedDistrict === 'All Districts' || item.district === this.selectedDistrict;
      const matchDiv = this.selectedDivision === 'All Divisions' || item.division === this.selectedDivision;
      const matchStatus = !this.selectedStatus || item.status === this.selectedStatus;
      const matchSearch = !q || item.memberName.toLowerCase().includes(q) || item.claimNo.toLowerCase().includes(q) || item.schemeName.toLowerCase().includes(q);
      return matchDist && matchDiv && matchStatus && matchSearch;
    });

    // Update dynamic summary KPI stats based on filtered results
    if (this.selectedDistrict !== 'All Districts' || this.selectedDivision !== 'All Divisions' || this.selectedStatus) {
      this.memberStats.totalMembers = this.filteredMemberList.length * 150 + 42;
      this.memberStats.cardIssued = Math.floor(this.memberStats.totalMembers * 0.85);
      this.memberStats.dmPending = Math.floor(this.memberStats.totalMembers * 0.10);
      this.memberStats.hqPending = this.memberStats.totalMembers - this.memberStats.cardIssued - this.memberStats.dmPending;

      this.schemeStats.totalApply = this.filteredSchemeList.length * 200 + 35;
      this.schemeStats.approved = Math.floor(this.schemeStats.totalApply * 0.82);
      this.schemeStats.paymentPending = Math.floor(this.schemeStats.totalApply * 0.08);
      this.schemeStats.totalDisbursedAmount = this.schemeStats.approved * 15000;
    }
  }

  onFilterChange(): void {
    this.first = 0;
    this.updateQueryParams();
    this.applyFilters();
  }

  exportReport(): void {
    this.msg.add({ severity: 'info', summary: 'Export Started', detail: `Downloading TNCWWB ${this.activeCategory.toUpperCase()} Report for ${this.selectedDistrict}…` });
  }

  fmt(v: number): string { return (v || 0).toLocaleString('en-IN'); }
  fmtL(v: number): string {
    const lakhs = (v || 0) / 100000;
    return `₹${lakhs.toFixed(2)} L`;
  }
}
