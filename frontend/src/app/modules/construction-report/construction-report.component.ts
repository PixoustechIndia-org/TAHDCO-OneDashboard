import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { ConstructionReportService } from './construction-report.service';
import {
  ConstructionWork,
  ConstructionDashboard,
  ConstructionSchedule,
  ProgressUpdatePayload,
  DepartmentCategoryMatrixRow
} from './construction-report.models';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-construction-report',
  templateUrl: './construction-report.component.html',
  styleUrls: ['./construction-report.component.scss'],
  providers: [MessageService, ConfirmationService]
})
export class ConstructionReportComponent implements OnInit {
  activeTab: 'report' = 'report';

  loading = false;
  dashboard: ConstructionDashboard | null = null;
  matrixRows: DepartmentCategoryMatrixRow[] = [];
  worksList: ConstructionWork[] = [];
  schedulesList: ConstructionSchedule[] = [];
  totalRecords = 0;

  // Show / Hide Section Toggles
  showMatrixSection = true;
  showWorksSection = true;
  showAnalyticsSection = true;

  // Multi-Select & Search Filter Models
  searchTerm = '';
  selectedFinancialYears: string[] = [];
  selectedDivisions: string[] = [];
  selectedDepartments: string[] = [];
  selectedDistricts: string[] = [];
  selectedCategories: string[] = [];
  selectedStatuses: string[] = [];

  // Financial Year MultiSelect Options
  financialYears = [
    { label: '2026-2027', value: '2026-2027' },
    { label: '2025-2026', value: '2025-2026' },
    { label: '2024-2025', value: '2024-2025' },
    { label: '2023-2024', value: '2023-2024' },
    { label: '2022-2023', value: '2022-2023' }
  ];

  // Dropdown MultiSelect Options
  divisions = [
    { label: 'Chennai', value: 'Chennai' },
    { label: 'Coimbatore', value: 'Coimbatore' },
    { label: 'Madurai', value: 'Madurai' },
    { label: 'Salem', value: 'Salem' },
    { label: 'Thanjavur', value: 'Thanjavur' },
    { label: 'Tirunelveli', value: 'Tirunelveli' },
    { label: 'Trichy', value: 'Trichy' },
    { label: 'Vellore', value: 'Vellore' },
    { label: 'Viluppuram', value: 'Viluppuram' }
  ];

  // Division to District Mapping for Cascading Filters
  readonly divisionDistrictMap: Record<string, string[]> = {
    'Chennai': ['Chennai', 'Chengalpattu', 'Kancheepuram', 'Tiruvallur'],
    'Coimbatore': ['Coimbatore', 'Erode', 'Tiruppur', 'The Nilgiris'],
    'Madurai': ['Madurai', 'Dindigul', 'Theni', 'Sivagangai', 'Ramanathapuram', 'Virudhunagar'],
    'Salem': ['Salem', 'Dharmapuri', 'Krishnagiri', 'Namakkal'],
    'Thanjavur': ['Thanjavur', 'Thiruvarur', 'Nagapattinam', 'Mayiladuthurai', 'Pudukkottai'],
    'Tirunelveli': ['Tirunelveli', 'Tenkasi', 'Thoothukudi', 'Kanniyakumari'],
    'Trichy': ['Trichy', 'Karur', 'Ariyalur', 'Perambalur'],
    'Vellore': ['Vellore', 'Ranipet', 'Tirupathur', 'Tiruvannamalai'],
    'Viluppuram': ['Villupuram', 'Cuddalore', 'Kallakurichi']
  };

  allDistricts = [
    { label: 'Ariyalur', value: 'Ariyalur' },
    { label: 'Chengalpattu', value: 'Chengalpattu' },
    { label: 'Chennai', value: 'Chennai' },
    { label: 'Coimbatore', value: 'Coimbatore' },
    { label: 'Cuddalore', value: 'Cuddalore' },
    { label: 'Dharmapuri', value: 'Dharmapuri' },
    { label: 'Dindigul', value: 'Dindigul' },
    { label: 'Erode', value: 'Erode' },
    { label: 'Kallakurichi', value: 'Kallakurichi' },
    { label: 'Kancheepuram', value: 'Kancheepuram' },
    { label: 'Kanniyakumari', value: 'Kanniyakumari' },
    { label: 'Karur', value: 'Karur' },
    { label: 'Krishnagiri', value: 'Krishnagiri' },
    { label: 'Madurai', value: 'Madurai' },
    { label: 'Mayiladuthurai', value: 'Mayiladuthurai' },
    { label: 'Nagapattinam', value: 'Nagapattinam' },
    { label: 'Namakkal', value: 'Namakkal' },
    { label: 'Perambalur', value: 'Perambalur' },
    { label: 'Pudukkottai', value: 'Pudukkottai' },
    { label: 'Ramanathapuram', value: 'Ramanathapuram' },
    { label: 'Ranipet', value: 'Ranipet' },
    { label: 'Salem', value: 'Salem' },
    { label: 'Sivagangai', value: 'Sivagangai' },
    { label: 'Tenkasi', value: 'Tenkasi' },
    { label: 'Thanjavur', value: 'Thanjavur' },
    { label: 'Theni', value: 'Theni' },
    { label: 'The Nilgiris', value: 'The Nilgiris' },
    { label: 'Thoothukudi', value: 'Thoothukudi' },
    { label: 'Tiruchirappalli (Trichy)', value: 'Trichy' },
    { label: 'Tirunelveli', value: 'Tirunelveli' },
    { label: 'Tirupathur', value: 'Tirupathur' },
    { label: 'Tiruppur', value: 'Tiruppur' },
    { label: 'Tiruvallur', value: 'Tiruvallur' },
    { label: 'Tiruvannamalai', value: 'Tiruvannamalai' },
    { label: 'Thiruvarur', value: 'Thiruvarur' },
    { label: 'Vellore', value: 'Vellore' },
    { label: 'Villupuram', value: 'Villupuram' },
    { label: 'Virudhunagar', value: 'Virudhunagar' }
  ];

  departments = [
    { label: 'Adidravidar Welfare Department', value: 'Adidravidar Welfare Department' },
    { label: 'Tribal Welfare Department', value: 'Tribal Welfare Department' },
    { label: 'TAHDCO', value: 'TAHDCO' }
  ];

  categories = [
    { label: 'Hostels', value: 'Hostels' },
    { label: 'Schools', value: 'Schools' },
    { label: 'Village Knowledge Centre', value: 'Village Knowledge Centre' },
    { label: 'Village Knowledge Centre - shed', value: 'Village Knowledge Centre - shed' },
    { label: 'Community Hall', value: 'Community Hall' },
    { label: 'Shopping Complex', value: 'Shopping Complex' },
    { label: 'Katral Karpithal Koodam', value: 'Katral Karpithal Koodam' },
    { label: 'Special repair - Hostels', value: 'Special repair - Hostels' },
    { label: 'Special repair - Schools', value: 'Special repair - Schools' },
    { label: 'Multipurpose center', value: 'Multipurpose center' },
    { label: 'Others', value: 'Others' }
  ];

  statuses = [
    { label: 'Ongoing', value: 'Ongoing' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Delayed', value: 'Delayed' },
    { label: 'Not Started', value: 'Not Started' },
    { label: 'On Hold', value: 'On Hold' }
  ];

  // Cascading Available Districts based on Selected Divisions
  get availableDistricts(): { label: string; value: string }[] {
    if (!this.selectedDivisions || this.selectedDivisions.length === 0) {
      return this.allDistricts;
    }
    const allowedDistricts = new Set<string>();
    this.selectedDivisions.forEach(div => {
      const dList = this.divisionDistrictMap[div] || [];
      dList.forEach(d => allowedDistricts.add(d));
    });
    return this.allDistricts.filter(d => allowedDistricts.has(d.value));
  }

  // Dynamic Current Date Display
  get currentDateFormatted(): string {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // Selected Work / Detail Drawer State
  selectedWork: ConstructionWork | null = null;
  detailDrawerVisible = false;
  progressHistory: any[] = [];

  // Add / Edit Work Modal State
  workDialogVisible = false;
  isEditMode = false;
  workForm: Partial<ConstructionWork> = {};
  savingWork = false;

  // Edit Matrix Category Row Dialog State
  editMatrixDialogVisible = false;
  matrixForm: Partial<DepartmentCategoryMatrixRow> = {};
  savingMatrix = false;

  // Progress Update Modal State
  progressDialogVisible = false;
  progressForm: ProgressUpdatePayload = {
    progressPercentage: 0,
    progressDate: new Date().toISOString().split('T')[0],
    lastWeekProgress: '',
    thisWeekProgress: '',
    remarks: '',
    workStatus: 'Ongoing',
    photos: []
  };
  updatingProgress = false;

  constructor(
    public auth: AuthService,
    private service: ConstructionReportService,
    private msg: MessageService,
    private confirm: ConfirmationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  get userRole(): string {
    return this.auth.userRole || 'admin';
  }

  get canCreate(): boolean {
    return ['admin', 'ce', 'ee', 'ae'].includes(this.userRole.toLowerCase());
  }

  get canEdit(): boolean {
    return ['admin', 'ce', 'ee', 'ae'].includes(this.userRole.toLowerCase());
  }

  get canDelete(): boolean {
    return ['admin'].includes(this.userRole.toLowerCase());
  }

  get canUpdateProgress(): boolean {
    return ['admin', 'ce', 'ee', 'ae'].includes(this.userRole.toLowerCase());
  }

  private buildFilterPayload(): any {
    return {
      division: this.selectedDivisions,
      department: this.selectedDepartments,
      district: this.selectedDistricts,
      category: this.selectedCategories,
      status: this.selectedStatuses,
      financialYear: this.selectedFinancialYears,
      search: this.searchTerm
    };
  }

  loadAllData(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const filterPayload = this.buildFilterPayload();

    this.service.getDashboard(filterPayload).subscribe(dash => {
      this.dashboard = dash;
      this.matrixRows = dash?.categoryMatrix ? [...dash.categoryMatrix] : [];
      this.cdr.markForCheck();
    });

    this.service.getWorks(filterPayload).subscribe(res => {
      this.worksList = res.data;
      this.totalRecords = res.pagination?.totalRecords || res.data.length;
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  onDivisionChange(): void {
    // Sanitize selectedDistricts if they no longer exist in availableDistricts
    if (this.selectedDivisions && this.selectedDivisions.length > 0) {
      const validDistricts = new Set(this.availableDistricts.map(d => d.value));
      this.selectedDistricts = this.selectedDistricts.filter(d => validDistricts.has(d));
    }
    this.onFilterChange();
  }

  onFilterChange(): void {
    this.loadAllData();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedFinancialYears = [];
    this.selectedDivisions = [];
    this.selectedDepartments = [];
    this.selectedDistricts = [];
    this.selectedCategories = [];
    this.selectedStatuses = [];
    this.loadAllData();
  }

  // ── Work Details & Timeline ───────────────────────────────────────────────
  viewDetails(work: ConstructionWork): void {
    this.selectedWork = work;
    this.detailDrawerVisible = true;
    this.service.getProgressHistory(work.id).subscribe(history => {
      this.progressHistory = history;
      this.cdr.markForCheck();
    });
    this.cdr.markForCheck();
  }

  openAddWork(): void {
    this.isEditMode = false;
    this.workForm = {
      division: 'Trichy',
      district: 'Trichy',
      department: 'Adidravidar Welfare Department',
      category: 'Schools',
      workType: 'Civil Construction',
      numberOfFloors: 1,
      estimatedAmount: 0,
      expUptoPrevYear: 0,
      expDuringCurrYear: 0,
      agreementPeriod: '6 Month',
      progressPercentage: 0,
      workStatus: 'Ongoing',
      approvalStatus: 'Approved',
      responsibleOfficer: 'Executive Engineer'
    };
    this.workDialogVisible = true;
  }

  openEditWork(work: ConstructionWork): void {
    this.isEditMode = true;
    this.workForm = { ...work };
    this.workDialogVisible = true;
  }

  saveWork(): void {
    if (!this.workForm.nameOfPremises || !this.workForm.division || !this.workForm.district) {
      this.msg.add({ severity: 'warn', summary: 'Validation Error', detail: 'Premises name, division, and district are mandatory.' });
      return;
    }

    this.savingWork = true;
    const est = Number(this.workForm.estimatedAmount) || 0;
    const prev = Number(this.workForm.expUptoPrevYear) || 0;
    const curr = Number(this.workForm.expDuringCurrYear) || 0;
    const totalExp = prev + curr;
    this.workForm.totalExpenditure = totalExp;
    this.workForm.balanceAmount = Math.max(0, est - totalExp);

    if (this.isEditMode && this.workForm.id) {
      this.service.updateWork(this.workForm.id, this.workForm).subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Success', detail: 'Construction work updated successfully.' });
          this.workDialogVisible = false;
          this.savingWork = false;
          this.loadAllData();
        },
        error: () => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to update construction work.' });
          this.savingWork = false;
        }
      });
    } else {
      this.service.createWork(this.workForm).subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Success', detail: 'New construction work created successfully.' });
          this.workDialogVisible = false;
          this.savingWork = false;
          this.loadAllData();
        },
        error: () => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to create construction work.' });
          this.savingWork = false;
        }
      });
    }
  }

  // ── Matrix Category Row Edit ───────────────────────────────────────────────
  openEditMatrixRow(row: DepartmentCategoryMatrixRow): void {
    this.matrixForm = { ...row };
    this.editMatrixDialogVisible = true;
  }

  saveMatrixRow(): void {
    if (!this.matrixForm || this.matrixForm.sNo === undefined) return;
    this.savingMatrix = true;

    // Recalculate Totals
    const adWorks = Number(this.matrixForm.adidravidarWorks) || 0;
    const trWorks = Number(this.matrixForm.tribalWorks) || 0;
    const taWorks = Number(this.matrixForm.tahdcoWorks) || 0;
    this.matrixForm.totalNoOfWorks = adWorks + trWorks + taWorks;

    const adEst = Number(this.matrixForm.adidravidarEstAmt) || 0;
    const trEst = Number(this.matrixForm.tribalEstAmt) || 0;
    const taEst = Number(this.matrixForm.tahdcoEstAmt) || 0;
    this.matrixForm.totalEstAmt = adEst + trEst + taEst;

    const adExp = Number(this.matrixForm.adidravidarTotalExp) || 0;
    const trExp = Number(this.matrixForm.tribalTotalExp) || 0;
    const taExp = Number(this.matrixForm.tahdcoTotalExp) || 0;
    const totalExp = adExp + trExp + taExp;
    this.matrixForm.totalExp = totalExp;
    this.matrixForm.balance = Math.max(0, this.matrixForm.totalEstAmt - totalExp);

    // Update in matrixRows array
    const idx = this.matrixRows.findIndex(r => r.sNo === this.matrixForm.sNo);
    if (idx !== -1) {
      this.matrixRows[idx] = { ...(this.matrixForm as DepartmentCategoryMatrixRow) };
      this.matrixRows = [...this.matrixRows];
      if (this.dashboard) {
        this.dashboard.categoryMatrix = this.matrixRows;
      }
    }

    this.savingMatrix = false;
    this.editMatrixDialogVisible = false;
    this.msg.add({ severity: 'success', summary: 'Updated', detail: `Category "${this.matrixForm.description}" row data updated successfully.` });
    this.cdr.markForCheck();
  }

  // ── Progress Update Modal ──────────────────────────────────────────────────
  openProgressDialog(work: ConstructionWork): void {
    this.selectedWork = work;
    this.progressForm = {
      progressPercentage: work.progressPercentage,
      progressDate: new Date().toISOString().split('T')[0],
      lastWeekProgress: work.thisWeekProgress || work.lastWeekProgress || '',
      thisWeekProgress: '',
      remarks: '',
      workStatus: work.workStatus,
      photos: []
    };
    this.progressDialogVisible = true;
  }

  submitProgress(): void {
    if (!this.selectedWork) return;
    this.updatingProgress = true;
    this.service.updateProgress(this.selectedWork.id, this.progressForm).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Progress Logged', detail: 'Weekly progress recorded and submitted for review.' });
        this.progressDialogVisible = false;
        this.updatingProgress = false;
        this.loadAllData();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to record progress update.' });
        this.updatingProgress = false;
      }
    });
  }

  // ── Export Excel & PDF with Color Correction ─────────────────────────────
  exportExcel(): void {
    const exportData = this.worksList.map((w, idx) => ({
      'S.No': idx + 1,
      'G.O. Reference': w.goReference,
      'Division': w.division,
      'District': w.district,
      'Place': w.place,
      'Name of Premises': w.nameOfPremises,
      'Components': w.components,
      'Department': w.department,
      'Category': w.category,
      'Work Type': w.workType,
      'Estimated Amt (₹ Lakh)': w.estimatedAmount,
      'Exp Upto Prev Year (₹ Lakh)': w.expUptoPrevYear,
      'Exp During Curr Year (₹ Lakh)': w.expDuringCurrYear,
      'Total Expenditure (₹ Lakh)': w.totalExpenditure,
      'Balance Sanction (₹ Lakh)': w.balanceAmount,
      'Work Order Date': w.workOrderDate || '-',
      'Agreement Date': w.agreementDate || '-',
      'Agreement Period': w.agreementPeriod,
      'Commencement Date': w.actualCommencementDate || '-',
      'Agt Comp Date': w.completionDateAsPerAgt || '-',
      'Probable Comp Date': w.probableDateOfCompletion || '-',
      'Progress %': w.progressPercentage,
      'Work Status': w.workStatus,
      'Approval Status': w.approvalStatus,
      'Responsible Officer': w.responsibleOfficer,
      'Last Updated': w.lastUpdated
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();

    // Auto-fit column widths
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length + 3, 14)
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Construction Works');
    XLSX.writeFile(wb, `TAHDCO_Construction_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.msg.add({ severity: 'success', summary: 'Exported', detail: 'Executive Excel spreadsheet generated successfully.' });
  }

  exportPdf(): void {
    const doc = new jsPDF('landscape', 'mm', 'a4');

    // Color Palette: Deep Navy & Emerald Executive Header
    doc.setFillColor(15, 23, 42); // #0f172a Deep Navy
    doc.rect(0, 0, 297, 24, 'F');

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('TAHDCO — Construction Work Status Report', 14, 11);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225); // #cbd5e1
    doc.text(`As on ${this.currentDateFormatted} | Filtered Scope (${this.worksList.length} works) | Civil & Infrastructure Monitoring`, 14, 18);

    const tableData = this.worksList.map((w, idx) => [
      idx + 1,
      w.goReference,
      w.division,
      w.district,
      w.nameOfPremises,
      w.department,
      w.category,
      `₹ ${w.estimatedAmount.toFixed(2)}`,
      `₹ ${w.totalExpenditure.toFixed(2)}`,
      `₹ ${w.balanceAmount.toFixed(2)}`,
      `${w.progressPercentage}%`,
      w.probableDateOfCompletion || '-',
      w.workStatus
    ]);

    autoTable(doc, {
      head: [['S.N', 'G.O. Ref', 'Division', 'District', 'Name of Premises', 'Department', 'Category', 'Est. Amt (₹L)', 'Total Exp (₹L)', 'Balance (₹L)', 'Prog %', 'Prob. Comp.', 'Status']],
      body: tableData,
      startY: 28,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        textColor: [30, 41, 59], // #1e293b
        lineColor: [226, 232, 240], // #e2e8f0
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [15, 23, 42], // #0f172a Deep Slate Navy
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // #f8fafc Clean Zebra
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { fontStyle: 'bold', cellWidth: 22 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { fontStyle: 'bold', cellWidth: 46 },
        5: { cellWidth: 32 },
        6: { cellWidth: 26 },
        7: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 22 },
        8: { halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9], cellWidth: 22 },
        9: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87], cellWidth: 22 },
        10: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
        11: { halign: 'center', cellWidth: 22 },
        12: { halign: 'center', fontStyle: 'bold', cellWidth: 19 }
      }
    });

    doc.save(`TAHDCO_Construction_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    this.msg.add({ severity: 'success', summary: 'PDF Exported', detail: 'Color-corrected executive construction report PDF downloaded.' });
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed': return 'badge-completed';
      case 'ongoing': return 'badge-ongoing';
      case 'delayed': return 'badge-delayed';
      case 'on hold': return 'badge-hold';
      default: return 'badge-neutral';
    }
  }
}
