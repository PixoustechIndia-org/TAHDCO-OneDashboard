import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-audit-log',
  templateUrl: './audit-log.component.html',
  styleUrls: ['./audit-log.component.scss'],
  providers: [MessageService]
})
export class AuditLogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = false;
  auditLogs: any[] = [];
  filteredLogs: any[] = [];

  // Filter States
  selectedAction = '';
  selectedModule = '';
  selectedRole = '';
  searchTerm = '';

  actionOptions = [
    { label: 'All Action Categories', value: '' },
    { label: 'User Authentication / Login', value: 'Authentication' },
    { label: 'Data Ingestion Sync', value: 'Ingestion' },
    { label: 'Scheduler Job Configuration', value: 'Scheduler' },
    { label: 'Report & Excel Export', value: 'Export' },
    { label: 'User Management & Roles', value: 'User Management' },
    { label: 'Security & Permission Audit', value: 'Security' }
  ];

  moduleOptions = [
    { label: 'All Projects & Modules', value: '' },
    { label: 'TIPS TIME (Tenders & M-Books)', value: 'TIPS TIME' },
    { label: 'THMS (Housing)', value: 'THMS' },
    { label: 'TAMS (Skill Enrollment)', value: 'TAMS' },
    { label: 'TELP (Loans)', value: 'TELP' },
    { label: 'TNCWWB (Welfare Board)', value: 'TNCWWB' },
    { label: 'TOD (Official Diary)', value: 'TOD' },
    { label: 'Patrol 360 (CCTV Monitoring)', value: 'Patrol360' },
    { label: 'System Administration', value: 'System' }
  ];

  roleOptions = [
    { label: 'All Roles', value: '' },
    { label: 'Application Admin', value: 'admin' },
    { label: 'Managing Director (MD)', value: 'md' },
    { label: 'General Manager (GM)', value: 'gm' },
    { label: 'Chief Engineer (CE)', value: 'ce' },
    { label: 'Executive Engineer (EE)', value: 'ee' },
    { label: 'District Manager (DM)', value: 'dm' }
  ];

  // Summary Metrics
  summaryStats = {
    totalLogs: 142,
    securityEvents: 28,
    ingestionSyncs: 54,
    exportsGenerated: 36
  };

  first = 0;
  rows = 15;

  constructor(
    public auth: AuthService,
    private msg: MessageService
  ) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLogs(): void {
    this.loading = true;

    // Realistic Mock Comprehensive Audit Logs (Updated for this week)
    this.auditLogs = [
      { id: 'LOG-8801', timestamp: '2026-08-12 14:10:22', userName: 'Application Admin (HQ)', userEmail: 'admin@tahdco.in', role: 'admin', ipAddress: '192.168.1.10', category: 'Scheduler', module: 'System', action: 'Created Scheduler Job', details: 'Added recurring POST job for TELP District Summary (0 0 * * *)', status: 'SUCCESS' },
      { id: 'LOG-8802', timestamp: '2026-08-12 11:05:18', userName: 'Dr. Vijaya Rajan', userEmail: 'md@tahdco.in', role: 'md', ipAddress: '192.168.1.42', category: 'Authentication', module: 'System', action: 'User Sign In', details: 'Successful JWT authentication from Executive Portal session', status: 'SUCCESS' },
      { id: 'LOG-8803', timestamp: '2026-08-12 09:48:50', userName: 'Karthik Selvam', userEmail: 'dm@tahdco.in', role: 'dm', ipAddress: '10.20.14.88', category: 'Ingestion', module: 'THMS', action: 'Trigger Ingestion Sync', details: 'Initiated manual sync for Madurai district housing phase 1 records', status: 'SUCCESS' },
      { id: 'LOG-8804', timestamp: '2026-08-11 16:30:12', userName: 'Application Admin (HQ)', userEmail: 'admin@tahdco.in', role: 'admin', ipAddress: '192.168.1.10', category: 'User Management', module: 'System', action: 'Update User Privilege', details: 'Granted TNCWWB access permission to EE - Coimbatore division user', status: 'SUCCESS' },
      { id: 'LOG-8805', timestamp: '2026-08-11 14:55:04', userName: 'Meena Priya', userEmail: 'ee@tahdco.in', role: 'ee', ipAddress: '10.30.55.12', category: 'Export', module: 'TIPS TIME', action: 'Exported Datatable', details: 'Exported TIPS Tender Detailed Name List to Excel (Chennai Division)', status: 'SUCCESS' },
      { id: 'LOG-8806', timestamp: '2026-08-11 10:15:40', userName: 'Rajesh Kumar', userEmail: 'gm@tahdco.in', role: 'gm', ipAddress: '192.168.1.55', category: 'Export', module: 'TNCWWB', action: 'Exported Report', details: 'Exported TNCWWB Member Registration summary report for FY 2026', status: 'SUCCESS' },
      { id: 'LOG-8807', timestamp: '2026-08-11 08:42:19', userName: 'Application Admin (HQ)', userEmail: 'admin@tahdco.in', role: 'admin', ipAddress: '192.168.1.10', category: 'Security', module: 'System', action: 'Failed Auth Attempt', details: 'Failed password attempt for user account test_user@tahdco.in', status: 'FAILED' },
      { id: 'LOG-8808', timestamp: '2026-08-10 15:05:33', userName: 'Er. K. Swaminathan', userEmail: 'ce@tahdco.in', role: 'ce', ipAddress: '192.168.1.80', category: 'Ingestion', module: 'Patrol360', action: 'CCTV Status Query', details: 'Queried Patrol360 active camera stream status across 38 districts', status: 'SUCCESS' },
      { id: 'LOG-8809', timestamp: '2026-08-10 11:20:00', userName: 'Karthik Selvam', userEmail: 'dm@tahdco.in', role: 'dm', ipAddress: '10.20.14.88', category: 'User Management', module: 'TAMS', action: 'Updated Beneficiary', details: 'Approved trainee enrollment list for Salem ITI vocational center', status: 'SUCCESS' },
      { id: 'LOG-8810', timestamp: '2026-08-10 09:12:45', userName: 'Application Admin (HQ)', userEmail: 'admin@tahdco.in', role: 'admin', ipAddress: '192.168.1.10', category: 'Scheduler', module: 'TOD', action: 'Executed Dynamic Job', details: 'Dynamic worker job #14 executed GET OnePortal TOD endpoint', status: 'SUCCESS' }
    ];

    this.applyFilters();
    this.loading = false;
  }

  applyFilters(): void {
    const q = (this.searchTerm || '').trim().toLowerCase();

    this.filteredLogs = this.auditLogs.filter(log => {
      const matchCat = !this.selectedAction || log.category === this.selectedAction;
      const matchMod = !this.selectedModule || log.module === this.selectedModule;
      const matchRole = !this.selectedRole || log.role === this.selectedRole;
      const matchSearch = !q ||
        log.userEmail.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.ipAddress.includes(q);

      return matchCat && matchMod && matchRole && matchSearch;
    });

    this.summaryStats.totalLogs = this.filteredLogs.length;
  }

  onFilterChange(): void {
    this.first = 0;
    this.applyFilters();
  }

  exportAuditLogs(): void {
    this.msg.add({ severity: 'info', summary: 'Audit Export', detail: 'Downloading System Audit Log Report to CSV…' });
  }
}
