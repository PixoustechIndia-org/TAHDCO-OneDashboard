export interface ConstructionWork {
  id: number;
  goReference: string;
  division: string;
  district: string;
  place: string;
  nameOfPremises: string;
  components: string;
  department: string;
  category: string;
  workType: string;
  numberOfFloors: number;
  estimatedAmount: number;
  expUptoPrevYear: number;
  expDuringCurrYear: number;
  totalExpenditure: number;
  balanceAmount: number;
  workOrderDate?: string;
  agreementDate?: string;
  agreementPeriod: string;
  actualCommencementDate?: string;
  completionDateAsPerAgt?: string;
  probableDateOfCompletion?: string;
  progressPercentage: number;
  previousProgressPercentage?: number;
  lastWeekProgress?: string;
  thisWeekProgress?: string;
  workStatus: 'Not Started' | 'Ongoing' | 'Completed' | 'Delayed' | 'On Hold';
  approvalStatus: 'Draft' | 'Submitted' | 'Reviewed' | 'Approved' | 'Rejected';
  responsibleOfficer: string;
  lastUpdated: string;
  remarks?: string;
}

export interface DepartmentCategoryMatrixRow {
  sNo: number;
  description: string;
  totalNoOfWorks: number;
  totalEstAmt: number;

  adidravidarWorks: number;
  adidravidarEstAmt: number;
  adidravidarExpUptoPrev?: number;
  adidravidarExpDuringCurr?: number;
  adidravidarTotalExp: number;

  tribalWorks: number;
  tribalEstAmt: number;
  tribalExpUptoPrev?: number;
  tribalExpDuringCurr?: number;
  tribalTotalExp: number;

  tahdcoWorks: number;
  tahdcoEstAmt: number;
  tahdcoExpUptoPrev?: number;
  tahdcoExpDuringCurr?: number;
  tahdcoTotalExp: number;

  totalExp: number;
  balance: number;
}

export interface ConstructionDashboard {
  totalWorks: number;
  ongoingWorks: number;
  completedWorks: number;
  delayedWorks: number;
  notStartedWorks: number;
  overdueUpdatesCount: number;
  totalEstimatedAmount: number;
  totalExpUptoPrevYear: number;
  totalExpDuringCurrYear: number;
  totalExpenditure: number;
  balanceAmount: number;
  categoryMatrix: DepartmentCategoryMatrixRow[];
  statusDistribution: { status: string; count: number; percentage: number; color: string }[];
  districtBreakdown: { district: string; totalWorks: number; completedWorks: number; ongoingWorks: number; delayedWorks: number; totalEstAmt: number; totalExp: number }[];
}

export interface ProgressUpdatePayload {
  progressPercentage: number;
  progressDate: string;
  lastWeekProgress: string;
  thisWeekProgress: string;
  remarks: string;
  workStatus: string;
  photos?: string[];
  documents?: string[];
}

export interface ConstructionSchedule {
  id: number;
  workId: number;
  workName: string;
  district: string;
  responsibleOfficer: string;
  frequency: 'Weekly' | 'Fortnightly' | 'Monthly';
  startDate: string;
  nextDueDate: string;
  reminder: string;
  status: 'Pending' | 'Submitted' | 'Reviewed' | 'Approved' | 'Overdue';
  isOverdue: boolean;
}

export interface ConstructionFilter {
  division?: string;
  department?: string;
  district?: string;
  financialYear?: string;
  workType?: string;
  category?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
