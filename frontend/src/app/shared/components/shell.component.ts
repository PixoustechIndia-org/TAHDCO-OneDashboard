import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { User, ROLE_META } from '../../core/models';
import { DataService } from '../../core/services/data.service';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
  providers: [ConfirmationService, MessageService]
})
export class ShellComponent implements OnInit {
  user: User | null = null;
  collapsed = false;
  mobileMenuOpen = false;

  toggleMenu() {
    if (window.innerWidth <= 1023) {
      this.mobileMenuOpen = !this.mobileMenuOpen;
    } else {
      this.collapsed = !this.collapsed;
    }
  }
  currentUrl = '';
  notifCount = 3;
  cacheClearing = false;

  // Change Password Modal State
  changePasswordVisible = false;
  cpLoading = false;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  cpForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  openChangePasswordDialog(): void {
    this.cpForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
    this.showCurrentPassword = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
    this.changePasswordVisible = true;
    this.cdr.markForCheck();
  }

  submitChangePassword(): void {
    if (!this.cpForm.currentPassword || !this.cpForm.newPassword || !this.cpForm.confirmPassword) {
      this.msg.add({ severity: 'warn', summary: 'Required Fields', detail: 'Please fill in all password fields.' });
      return;
    }
    if (this.cpForm.newPassword !== this.cpForm.confirmPassword) {
      this.msg.add({ severity: 'error', summary: 'Mismatch', detail: 'New password and confirmation password do not match.' });
      return;
    }
    if (this.cpForm.newPassword.length < 6) {
      this.msg.add({ severity: 'warn', summary: 'Too Short', detail: 'New password must be at least 6 characters.' });
      return;
    }

    this.cpLoading = true;
    const url = `${environment.apiUrl || ''}/api/v1/auth/change-password`;
    const payload = {
      email: this.user?.email || '',
      currentPassword: this.cpForm.currentPassword,
      newPassword: this.cpForm.newPassword,
      confirmPassword: this.cpForm.confirmPassword
    };

    this.http.post<any>(url, payload).subscribe({
      next: (res) => {
        this.cpLoading = false;
        this.changePasswordVisible = false;
        this.msg.add({ severity: 'success', summary: 'Password Updated', detail: res?.message || 'Your security password has been changed successfully.' });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.cpLoading = false;
        const msgText = err.error?.message || 'Unable to update password. Please check your current password and try again.';
        this.msg.add({ severity: 'error', summary: 'Update Failed', detail: msgText });
        this.cdr.markForCheck();
      }
    });
  }

  navGroups = [
    {
      label: 'Home',
      items: [
        { label: 'Overview', icon: 'pi-chart-pie', route: '/overview' },
        { label: 'Dashboard', icon: 'pi-compass', route: '/dashboard-md' },
        { label: 'ConstructionWork Report', sub: 'Civil Projects & Progress', icon: 'pi-building', route: '/construction-work-report' },
      ]
    },
    {
      label: 'Configuration',
      roles: ['admin'],
      items: [
        {
          label: 'Configuration Hub',
          sub: 'Setup & Mappings',
          icon: 'pi-cog',
          route: '/configuration',
          roles: ['admin'],
          expanded: true,
          children: [
            { label: '1. Role Management', sub: 'CRUD Operation', icon: 'pi-id-card', route: '/configuration', queryParams: { tab: 'roles' }, roles: ['admin'] },
            { label: '2. Project Details', sub: 'Eng / Welfare / TNCWWN', icon: 'pi-folder', route: '/configuration', queryParams: { tab: 'projects' }, roles: ['admin'] },
            { label: '3. Project Mapping', sub: 'Role & Project Mapping', icon: 'pi-sliders-h', route: '/configuration', queryParams: { tab: 'mappings' }, roles: ['admin'] },
            { label: '4. User Privileges', sub: 'CRUD Permissions', icon: 'pi-shield', route: '/configuration', queryParams: { tab: 'privileges' }, roles: ['admin'] },
            { label: '5. Local Body Master', sub: 'TN Administrative Master', icon: 'pi-map', route: '/configuration', queryParams: { tab: 'localbody' }, roles: ['admin'] }
          ]
        },
        { label: 'Change Password', sub: 'Security Settings', icon: 'pi-key', action: 'changePassword' }
      ]
    },
    {
      label: 'Admin & Operations',
      roles: ['admin'],
      items: [
        { label: 'User Master',           icon: 'pi-users',  route: '/user-master',            roles: ['admin'] },
        { label: 'AI Engine Analytics',   icon: 'pi-sparkles', route: '/ai-analytics',          roles: ['admin'] },
        { label: 'Data Ingestion Engine', icon: 'pi-sync',   route: '/ingestion',             roles: ['admin'] },
        { label: 'Scheduler Control',     icon: 'pi-clock',  route: '/scheduler-management',   roles: ['admin'] },
        { label: 'Audit Log',             icon: 'pi-history',route: '/audit-log',             roles: ['admin'] }
      ]
    },
  ];

  // Help & Guides Modal State
  helpModalVisible = false;

  openHelpModal(): void {
    this.helpModalVisible = true;
    this.cdr.markForCheck();
  }

  // Notification Modal State& Filters ──────────────────────────────────────
  notifDialogVisible = false;
  notifLoading = false;
  notificationsList: any[] = [];
  
  selNotifProject = '';
  selNotifFreq = '';
  selNotifStatus = '';
  notifSearchText = '';

  projectFilterOptions = [
    { label: 'All Projects', value: '' },
    { label: 'TIPS TIME', value: 'TIPS TIME' },
    { label: 'THMS', value: 'THMS' },
    { label: 'TAMS', value: 'TAMS' },
    { label: 'TELP', value: 'TELP' },
    { label: 'TNCWWB', value: 'TNCWWB' },
    { label: 'TOD', value: 'TOD' },
    { label: 'Patrol 360', value: 'Patrol360' }
  ];

  freqFilterOptions = [
    { label: 'All Frequencies', value: '' },
    { label: 'Daily', value: 'Daily' },
    { label: 'Weekly', value: 'Weekly' },
    { label: 'Monthly', value: 'Monthly' },
    { label: 'Quarterly', value: 'Quarterly' },
    { label: 'Half-Yearly', value: 'Half-Yearly' },
    { label: 'Yearly', value: 'Yearly' }
  ];

  statusFilterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Not Started', value: 'Not Started' },
    { label: 'Started', value: 'Started' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Pending Approval', value: 'Pending Approval' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Overdue', value: 'Overdue' }
  ];

  // ── Global Header Search Dropdown ─────────────────────────────────────
  headerSearchQuery = '';
  showSearchDropdown = false;
  searchResults: { modules: any[]; districts: any[]; works: any[] } = { modules: [], districts: [], works: [] };

  constructor(
    public auth: AuthService,
    public router: Router,
    private http: HttpClient,
    private confirm: ConfirmationService,
    private ds: DataService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  clearCache(): void {
    this.cacheClearing = true;
    this.ds.clearAllCache().subscribe({
      next: () => {
        this.cacheClearing = false;
        this.msg.add({ 
          severity: 'success', 
          summary: 'Cache Cleared Successfully', 
          detail: 'Local memory & storage cache purged. Pages reloaded with fresh database records.' 
        });
      },
      error: () => {
        this.cacheClearing = false;
      }
    });
  }

  // ── Navigation Bar Global Filter Controls ─────────────────────────────
  getCurrentFinancialYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0 = Jan, 3 = Apr
    const startYear = month >= 3 ? year : year - 1;
    const endYear = (startYear + 1).toString().slice(-2);
    return `FY ${startYear}-${endYear}`;
  }

  selFY: string[] = [this.getCurrentFinancialYear()];
  selDiv: string[] = [];
  viewMode: 'count' | 'cost' | 'both' = 'count';

  fyOptions = [
    { label: 'FY 2026-27', value: 'FY 2026-27' },
    { label: 'FY 2025-26', value: 'FY 2025-26' },
    { label: 'FY 2024-25', value: 'FY 2024-25' },
    { label: 'FY 2023-24', value: 'FY 2023-24' },
    { label: 'FY 2022-23', value: 'FY 2022-23' }
  ];

  divOptions = [
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

  onTopFilterChange(): void {
    this.ds.setGlobalFilters({
      selFY: this.selFY,
      selDiv: this.selDiv,
      viewMode: this.viewMode
    });
  }

  setTopView(mode: 'count' | 'cost' | 'both'): void {
    this.viewMode = mode;
    this.ds.setGlobalFilters({ viewMode: mode });
  }

  get roleHeaderInfo(): { badge: string; title: string; subtitle: string } {
    const role = (this.auth.userRole || 'md').toLowerCase();
    switch (role) {
      case 'ce':
        return {
          badge: 'CE',
          title: 'Dashboard',
          subtitle: 'Chief Engineer · Technical & Construction'
        };
      case 'gm':
        return {
          badge: 'GM',
          title: 'Dashboard',
          subtitle: 'General Manager · Welfare & Schemes'
        };
      case 'ee':
        const div = this.auth.currentUser?.divisionName || 'Division';
        return {
          badge: 'EE',
          title: 'Dashboard',
          subtitle: `Executive Engineer · ${div}`
        };
      case 'dm':
        const dist = this.auth.currentUser?.districtName || 'District';
        return {
          badge: 'DM',
          title: 'Dashboard',
          subtitle: `District Manager · ${dist}`
        };
      case 'secretary':
        return {
          badge: 'SEC',
          title: 'Dashboard',
          subtitle: 'Secretary · Executive Oversight'
        };
      case 'admin':
        return {
          badge: 'ADM',
          title: 'Dashboard',
          subtitle: (this.auth.currentUser?.scope === 'all' ? 'Application Admin (HQ)' : 'Application Admin (District)') + ' · Master System View'
        };
      case 'md':
      default:
        return {
          badge: 'MD',
          title: 'Dashboard',
          subtitle: 'Managing Director · Strategic View'
        };
    }
  }

  ngOnInit(): void {
    this.auth.user$.subscribe(u => this.user = u);
    this.ds.globalFilters$.subscribe(f => {
      this.selFY = f.selFY;
      this.selDiv = f.selDiv;
      this.viewMode = f.viewMode;
    });
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.currentUrl = e.urlAfterRedirects || e.url;
    });
    this.currentUrl = this.router.url;
  }

  visibleItems(items: any[]) {
    return items.filter(i =>
      (!i.app || this.auth.hasAppAccess(i.app)) &&
      (!i.apps || i.apps.some((a: string) => this.auth.hasAppAccess(a))) &&
      (!i.roles || this.auth.hasRole(...i.roles))
    );
  }

  groupVisible(group: any): boolean {
    if (group.roles && !this.auth.hasRole(...group.roles)) return false;
    return this.visibleItems(group.items).length > 0;
  }

  navigateTo(item: any): void {
    if (window.innerWidth <= 1023) {
      this.mobileMenuOpen = false;
    }
    if (item.action === 'changePassword') {
      this.openChangePasswordDialog();
      return;
    }
    if (item.queryParams) {
      this.router.navigate([item.route], { queryParams: item.queryParams });
    } else if (item.route) {
      this.router.navigate([item.route]);
    }
  }

  navigateToParent(item: any): void {
    item.expanded = !item.expanded;
    if (item.route) {
      this.navigateTo(item);
    }
  }

  toggleAccordion(item: any, event?: Event): void {
    if (event) event.stopPropagation();
    item.expanded = !item.expanded;
  }

  isActive(item: any): boolean {
    const route = item.route;
    if (!route) return false;
    const curr = this.currentUrl;
    
    if (item.queryParams && item.queryParams.tab) {
      return curr.includes(route) && curr.includes(`tab=${item.queryParams.tab}`);
    }
    if (item.children && item.children.length > 0) {
      return item.children.some((c: any) => this.isActive(c)) || (curr.startsWith(route) && !curr.includes('tab='));
    }
    if (route === '/configuration' && curr.startsWith('/configuration') && !curr.includes('tab=')) return true;
    if (curr === route || (route !== '/overview' && route !== '/configuration' && curr.startsWith(route))) return true;
    
    // Dynamic drill matches
    if (route === '/housing' && curr.includes('/drill/housing')) return true;
    if (route === '/tender' && (curr.includes('/drill/tender') || curr.includes('/drill/time'))) return true;
    if (route === '/enrollment' && curr.includes('/drill/enrollment')) return true;
    if (route === '/scheme-report' && (curr.includes('/drill/scheme') || curr.includes('/drill/telp') || curr.includes('/drill/oneportal'))) return true;
    if (route === '/tncwwb' && (curr.includes('/tncwwb') || curr.includes('/drill/tncwwb'))) return true;
    if (route === '/tod' && curr.includes('/drill/tod')) return true;
    if (route === '/patrol360' && curr.includes('/drill/patrol')) return true;

    return false;
  }

  get roleLabel(): string { return this.user ? ROLE_META[this.user.role]?.label ?? '' : ''; }
  get roleShort(): string { return this.user ? ROLE_META[this.user.role]?.short ?? '' : ''; }
  get scopeLine(): string {
    if (!this.user) return '';
    const meta = ROLE_META[this.user.role];
    const place = this.user.divisionName || this.user.districtName;
    return place ? `${meta.scopeLabel} · ${place}` : meta.scopeLabel;
  }
  get initials() {
    return (this.user?.name || '').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  }

  logout() {
    this.confirm.confirm({
      message: 'Are you sure you want to sign out? Your active session will be ended securely.',
      header: 'Sign Out Confirmation',
      icon: 'pi pi-sign-out',
      acceptLabel: 'Sign Out',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-outlined p-button-secondary p-button-sm mr-2',
      accept: () => this.auth.logout()
    });
  }

  // ── Notifications Handling ──────────────────────────────────────────────
  openNotifications() {
    this.notifDialogVisible = true;
    this.loadNotifications();
  }

  loadNotifications() {
    this.notifLoading = true;
    this.ds.getNotifications(this.selNotifProject, this.selNotifFreq, this.selNotifStatus, this.notifSearchText).subscribe({
      next: (res) => {
        let rawList = res || [];
        // Apply client-side filtering if backend returns unfiltered mock list
        if (this.selNotifProject) {
          rawList = rawList.filter(item => (item.project || '').toLowerCase().includes(this.selNotifProject.toLowerCase()));
        }
        if (this.selNotifFreq) {
          rawList = rawList.filter(item => (item.frequency || '').toLowerCase() === this.selNotifFreq.toLowerCase());
        }
        if (this.selNotifStatus) {
          rawList = rawList.filter(item => (item.status || '').toLowerCase() === this.selNotifStatus.toLowerCase());
        }
        if (this.notifSearchText) {
          const q = this.notifSearchText.toLowerCase();
          rawList = rawList.filter(item => (item.subject || '').toLowerCase().includes(q) || (item.message || '').toLowerCase().includes(q));
        }

        // Ensure fallback defaults so no empty dashed cards ever render
        this.notificationsList = rawList.map((item, idx) => ({
          notificationId: item.notificationId || `notif-${idx}`,
          project: item.project || (this.selNotifProject || 'THMS'),
          frequency: item.frequency || (this.selNotifFreq || 'Daily'),
          status: item.status || (this.selNotifStatus || 'In Progress'),
          subject: item.subject || `${item.project || 'THMS'} Scheduled Activity Alert #${idx + 1}`,
          message: item.message || `Operational alert logged for ${item.project || 'THMS'} milestone tracking.`,
          sentAt: item.sentAt || 'Just now',
          isRead: !!item.isRead
        }));

        this.notifLoading = false;
      },
      error: () => {
        this.notifLoading = false;
      }
    });
  }

  onNotifFilterChange() {
    this.loadNotifications();
  }

  resetNotifFilters() {
    this.selNotifProject = '';
    this.selNotifFreq = '';
    this.selNotifStatus = '';
    this.notifSearchText = '';
    this.loadNotifications();
  }

  // ── Header Search ──────────────────────────────────────────────────────
  onHeaderSearch() {
    const q = (this.headerSearchQuery || '').trim().toLowerCase();
    if (!q || q.length < 2) {
      this.showSearchDropdown = false;
      this.searchResults = { modules: [], districts: [], works: [] };
      return;
    }

    const modules = [
      { name: 'Tender Integrated Process System (TIPS TIME)', code: 'TIPS', route: '/tender', icon: 'pi-file-edit' },
      { name: 'Housing Management System (THMS)', code: 'THMS', route: '/housing', icon: 'pi-building' },
      { name: 'Attendance Management System (TAMS)', code: 'TAMS', route: '/enrollment', icon: 'pi-graduation-cap' },
      { name: 'Schemes & Educational Loans (TELP / Scheme)', code: 'TELP', route: '/scheme-report', icon: 'pi-wallet' },
      { name: 'Construction Workers Welfare Board (TNCWWB)', code: 'TNCWWB', route: '/scheme-report', icon: 'pi-id-card' },
      { name: 'Online Diary Portal (TOD)', code: 'TOD', route: '/tod', icon: 'pi-calendar' },
      { name: 'CCTV & Monitoring (Patrol 360)', code: 'Patrol360', route: '/patrol360', icon: 'pi-video' }
    ].filter(m => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));

    const districts = [
      'Ariyalur', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kancheepuram',
      'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur',
      'Pudukkottai', 'Ramanathapuram', 'Salem', 'Sivagangai', 'Thanjavur', 'Theni', 'Thiruchirappalli', 'Tirunelveli',
      'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Tuticorin', 'Vellore', 'Villupuram', 'Virudhunagar'
    ].filter(d => d.toLowerCase().includes(q)).map(d => ({ name: d, type: 'District Scope', route: '/dashboard-md' }));

    const works = [
      { ref: 'TENDER-2026-089', title: 'Construction of Community Hall in Tiruvallur', project: 'TIPS TIME', route: '/tender' },
      { ref: 'THMS-HOU-402', title: 'Free Housing Scheme Beneficiary Units in Madurai', project: 'THMS', route: '/housing' },
      { ref: 'TNCWWB-MEM-882', title: 'Registered Construction Worker Assistance in Coimbatore', project: 'TNCWWB', route: '/scheme-report' }
    ].filter(w => w.ref.toLowerCase().includes(q) || w.title.toLowerCase().includes(q) || w.project.toLowerCase().includes(q));

    this.searchResults = { modules, districts, works };
    this.showSearchDropdown = true;
  }

  selectSearchResult(route: string) {
    this.showSearchDropdown = false;
    this.headerSearchQuery = '';
    this.router.navigate([route]);
  }
}
