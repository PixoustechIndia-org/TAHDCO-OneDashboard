import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MessageService, ConfirmationService } from 'primeng/api';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { User, Role, ProjectPrivilege, DIVISIONS, DISTRICTS_BY_DIVISION } from '../../core/models';

const PROJECTS = ['Engineering', 'Welfare', 'TNCWWN', 'TIPS', 'TIME', 'THMS', 'TAMS', 'Scheme', 'TELP', 'OnePortal', 'TOD', 'Patrol360'];
const emptyPriv = (): ProjectPrivilege => ({ view: false, create: false, edit: false, update: false, delete: false });

@Component({
  selector: 'app-user-master',
  templateUrl: './user-master.component.html',
  styleUrls: ['./user-master.component.scss'],
  providers: [MessageService, ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserMasterComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  loading = true;
  searchTerm = '';
  roleFilter = '';
  first = 0;
  rows = 10;

  projects = PROJECTS;
  privActions: (keyof ProjectPrivilege)[] = ['view', 'create', 'edit', 'update', 'delete'];

  roleOptions = [
    { label: 'All roles', value: '' },
    { label: 'District Manager', value: 'dm' },
    { label: 'Executive Engineer', value: 'ee' },
    { label: 'Chief Engineer', value: 'ce' },
    { label: 'General Manager', value: 'gm' },
    { label: 'Managing Director', value: 'md' },
    { label: 'Secretary', value: 'secretary' },
    { label: 'Application Admin', value: 'admin' },
    { label: 'Engineering Lead', value: 'eng_lead' },
    { label: 'Welfare Officer', value: 'welfare_officer' },
    { label: 'TNCWWN Coordinator', value: 'tncwwn_coord' }
  ];
  divisionOptions = DIVISIONS.filter(d => d !== 'All Divisions').map(d => ({ label: d, value: d }));
  districtOptions: { label: string; value: string }[] = [];

  // Add/edit dialog
  dialogVisible = false;
  editingUser: Partial<User> & { password?: string; divisionName?: string; districtName?: string } = {};
  editingPrivs: Record<string, ProjectPrivilege> = {};
  isEditMode = false;
  saving = false;
  formSubmitted = false;
  showUserPassword = false;
  initialFormState = '';
  errors: { name?: string; email?: string; password?: string; role?: string; division?: string; district?: string } = {};

  // Select2 / Multi-Select Mode Support
  multiSelectMode = false;
  selectedDistricts: string[] = [];
  selectedDivisions: string[] = [];
  selectedProjectsList: string[] = [];

  private api = environment.apiUrl ? `${environment.apiUrl}/api/v1/users` : '/api/v1/users';

  constructor(
    private auth: AuthService,
    private http: HttpClient,
    private msg: MessageService,
    private confirm: ConfirmationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.loadUsers(); }

  trackByUserId(_i: number, u: User): number { return u.id; }
  trackByIndex(i: number, item: any): number { return i; }

  loadUsers(): void {
    this.loading = true;
    const local = () => {
      this.users = this.auth.getAllUsers();
      this.applyFilter(); this.loading = false; this.cdr.markForCheck();
    };
    if (!this.api) { setTimeout(local, 250); return; }
    this.http.get<User[]>(this.api).pipe(catchError(() => of(null))).subscribe(res => {
      if (res && res.length > 0) { this.users = res; this.applyFilter(); this.loading = false; this.cdr.markForCheck(); }
      else local();
    });
  }

  applyFilter(): void {
    const term = (this.searchTerm || '').toLowerCase().trim();
    const rf = (this.roleFilter || '').toLowerCase().trim();

    this.filteredUsers = this.users.filter(u => {
      const matchSearch = !term ||
        (u.name || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term) ||
        (u.districtName || '').toLowerCase().includes(term) ||
        (u.divisionName || '').toLowerCase().includes(term) ||
        (u.role || '').toLowerCase().includes(term);

      if (!rf) return matchSearch;

      const r = (u.role || '').toLowerCase().trim();
      let matchRole = false;

      if (rf === 'dm') matchRole = (r === 'dm' || r.includes('district'));
      else if (rf === 'ee') matchRole = (r === 'ee' || r.includes('executive'));
      else if (rf === 'ce') matchRole = (r === 'ce' || r.includes('chief'));
      else if (rf === 'gm') matchRole = (r === 'gm' || r.includes('general'));
      else if (rf === 'md') matchRole = (r === 'md' || r.includes('managing'));
      else if (rf === 'secretary') matchRole = (r === 'secretary' || r === 'sec');
      else if (rf === 'admin') matchRole = (r === 'admin' || r.includes('administrator'));
      else matchRole = (r === rf);

      return matchSearch && matchRole;
    });
    this.first = 0;
    this.cdr.markForCheck();
  }

  roleLabel(role: Role | string): string {
    const m: Record<string, string> = {
      dm: 'District Manager', ee: 'Executive Engineer', ce: 'Chief Engineer',
      'Chief Engineer': 'Chief Engineer', gm: 'General Manager',
      md: 'Managing Director', secretary: 'Secretary', admin: 'Application Admin',
      eng_lead: 'Engineering Lead', welfare_officer: 'Welfare Officer', tncwwn_coord: 'TNCWWB Coordinator'
    };
    return m[role] || role;
  }

  roleBadgeClass(role: Role | string): string {
    const m: Record<string, string> = {
      dm: 'b-green', ee: 'b-teal', ce: 'b-indigo', 'Chief Engineer': 'b-indigo',
      gm: 'b-gold', md: 'b-navy', secretary: 'b-purple', admin: 'b-red',
      eng_lead: 'b-teal', welfare_officer: 'b-green', tncwwn_coord: 'b-purple'
    };
    return m[role] || 'b-gray';
  }

  onDivisionChange(): void {
    let collectedDistricts: string[] = [];
    if (this.multiSelectMode && this.selectedDivisions.length > 0) {
      this.selectedDivisions.forEach(div => {
        const list = DISTRICTS_BY_DIVISION[div] || [];
        list.forEach(d => { if (!collectedDistricts.includes(d)) collectedDistricts.push(d); });
      });
    } else if (this.editingUser.divisionName) {
      collectedDistricts = DISTRICTS_BY_DIVISION[this.editingUser.divisionName] || [];
    } else {
      // All districts available if no specific division is restricted
      Object.values(DISTRICTS_BY_DIVISION).forEach(list => {
        list.forEach(d => { if (!collectedDistricts.includes(d)) collectedDistricts.push(d); });
      });
    }
    this.districtOptions = collectedDistricts.sort().map(d => ({ label: d, value: d }));
    if (this.editingUser.districtName && !collectedDistricts.includes(this.editingUser.districtName)) {
      this.editingUser.districtName = undefined;
    }
    this.cdr.markForCheck();
  }

  private initPrivs(existing?: Record<string, ProjectPrivilege>): void {
    this.editingPrivs = {};
    for (const p of PROJECTS) this.editingPrivs[p] = { ...emptyPriv(), ...(existing?.[p] || {}) };
  }

  /** Row shortcut: master checkbox = all five actions for that project. */
  allChecked(project: string): boolean {
    const pr = this.editingPrivs[project];
    return pr ? this.privActions.every(a => pr[a]) : false;
  }

  toggleAll(project: string, value: boolean): void {
    if (!this.editingPrivs[project]) this.editingPrivs[project] = emptyPriv();
    for (const a of this.privActions) this.editingPrivs[project][a] = value;
  }

  isDivisionRequired(): boolean {
    const r = this.editingUser.role;
    return r === 'dm' || r === 'ee';
  }

  isDistrictRequired(): boolean {
    return this.editingUser.role === 'dm';
  }

  validateField(field: string): void {
    const e = this.editingUser;
    switch (field) {
      case 'name':
        const nameRegex = /^[a-zA-Z\s.]+$/;
        if (!e.name || !e.name.trim()) this.errors.name = 'Full name is required.';
        else if (e.name.trim().length < 3) this.errors.name = 'Full name must be at least 3 characters.';
        else if (!nameRegex.test(e.name.trim())) this.errors.name = 'Full name should only contain letters, dots, and spaces.';
        else delete this.errors.name;
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!e.email || !e.email.trim()) this.errors.email = 'Email address is required.';
        else if (!emailRegex.test(e.email.trim())) this.errors.email = 'Please enter a valid email address (e.g. user@tahdco.in).';
        else delete this.errors.email;
        break;
      case 'password':
        const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{6,}$/;
        if (!this.isEditMode) {
          if (!e.password) this.errors.password = 'Password is required for new users.';
          else if (e.password.length < 6) this.errors.password = 'Password must be at least 6 characters.';
          else if (!pwdRegex.test(e.password)) this.errors.password = 'Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character (@$!%*?&#).';
          else delete this.errors.password;
        } else {
          if (e.password && e.password.trim().length > 0) {
            if (e.password.length < 6) this.errors.password = 'New password must be at least 6 characters.';
            else if (!pwdRegex.test(e.password)) this.errors.password = 'Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character (@$!%*?&#).';
            else delete this.errors.password;
          } else {
            delete this.errors.password;
          }
        }
        break;
      case 'role':
        if (!e.role || !e.role.trim()) this.errors.role = 'Role is mandatory. Please select a role.';
        else delete this.errors.role;
        break;
      case 'division':
        if (this.isDivisionRequired() && !e.divisionName && (!this.selectedDivisions || this.selectedDivisions.length === 0)) {
          this.errors.division = 'Division is required for this role.';
        } else {
          delete this.errors.division;
        }
        break;
      case 'district':
        if (this.isDistrictRequired() && !e.districtName && (!this.selectedDistricts || this.selectedDistricts.length === 0)) {
          this.errors.district = 'District is mandatory for District Manager.';
        } else {
          delete this.errors.district;
        }
        break;
    }
    this.cdr.markForCheck();
  }

  validateForm(): boolean {
    this.formSubmitted = true;
    this.errors = {};
    this.validateField('name');
    this.validateField('email');
    this.validateField('password');
    this.validateField('role');
    this.validateField('division');
    this.validateField('district');
    return Object.keys(this.errors).length === 0;
  }

  openAdd(): void {
    this.isEditMode = false;
    this.formSubmitted = false;
    this.showUserPassword = false;
    this.errors = {};
    this.selectedDistricts = [];
    this.selectedDivisions = [];
    this.editingUser = { name: '', email: '', password: '', role: '' as any, scope: 'district', appAccess: [], isActive: true };
    this.onDivisionChange();
    this.initPrivs();
    this.initialFormState = JSON.stringify(this.editingUser);
    this.dialogVisible = true;
    this.cdr.markForCheck();
  }

  openEdit(user: User): void {
    this.isEditMode = true;
    this.formSubmitted = false;
    this.showUserPassword = false;
    this.errors = {};
    this.editingUser = { ...user, password: '' };
    this.selectedDivisions = user.divisionName ? user.divisionName.split(',').map(s => s.trim()) : [];
    this.selectedDistricts = user.districtName ? user.districtName.split(',').map(s => s.trim()) : [];
    this.onDivisionChange();
    this.editingUser.districtName = user.districtName;
    this.initPrivs(user.privileges);
    this.initialFormState = JSON.stringify(this.editingUser);
    this.dialogVisible = true;
    this.cdr.markForCheck();
  }

  isFormDirty(): boolean {
    return JSON.stringify(this.editingUser) !== this.initialFormState;
  }

  closeDialog(): void {
    if (this.isFormDirty()) {
      this.confirm.confirm({
        message: 'You have unsaved changes. Are you sure you want to discard them?',
        header: 'Discard Changes?',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Discard', rejectLabel: 'Keep Editing',
        acceptButtonStyleClass: 'p-button-danger p-button-sm',
        rejectButtonStyleClass: 'p-button-outlined p-button-secondary p-button-sm mr-2',
        accept: () => {
          this.dialogVisible = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      this.dialogVisible = false;
      this.cdr.markForCheck();
    }
  }

  saveUser(): void {
    if (!this.validateForm()) {
      this.msg.add({ severity: 'error', summary: 'Validation Error', detail: 'Please fill in all mandatory fields with valid values.' });
      this.cdr.markForCheck();
      return;
    }

    const e = this.editingUser;
    // MultiSelect sync if used
    if (this.selectedDistricts && this.selectedDistricts.length > 0) {
      e.districtName = this.selectedDistricts[0];
    }
    if (this.selectedDivisions && this.selectedDivisions.length > 0) {
      e.divisionName = this.selectedDivisions[0];
    }

    // appAccess derives from view privileges; scope from role
    e.appAccess = PROJECTS.filter(p => this.editingPrivs[p].view);
    e.scope = e.role === 'dm' ? 'district' : e.role === 'ee' ? 'division' : 'all';
    e.privileges = JSON.parse(JSON.stringify(this.editingPrivs));

    const done = (detail: string) => {
      this.msg.add({ severity: 'success', summary: this.isEditMode ? 'User Updated' : 'User Created', detail });
      this.applyFilter(); this.dialogVisible = false; this.saving = false; this.cdr.markForCheck();
    };
    const localSave = () => {
      if (this.isEditMode) {
        const idx = this.users.findIndex(u => u.id === e.id);
        if (idx > -1) this.users[idx] = { ...this.users[idx], ...e } as User;
      } else {
        this.users = [...this.users, {
          ...(e as User), id: Math.max(0, ...this.users.map(u => u.id)) + 1, isActive: true
        }];
      }
      done(`${e.name} saved successfully.`);
    };

    this.saving = true;
    if (!this.api) { localSave(); return; }
    const req = this.isEditMode
      ? this.http.put(`${this.api}/${e.id}`, e)
      : this.http.post(this.api, e);
    req.pipe(catchError(() => of(null))).subscribe(res => {
      if (res) { this.loadUsers(); done(`${e.name} saved.`); }
      else localSave();
    });
  }

  toggleActive(user: User): void {
    user.isActive = !user.isActive;
    if (this.api) {
      this.http.put(`${this.api}/${user.id}`, user).pipe(catchError(() => of(null))).subscribe();
    }
    this.msg.add({ severity: 'info', summary: user.isActive ? 'Activated' : 'Deactivated',
      detail: `${user.name} is now ${user.isActive ? 'active' : 'inactive'}.` });
    this.cdr.markForCheck();
  }

  confirmDelete(user: User): void {
    this.confirm.confirm({
      message: `Remove ${user.name} from the portal?`, header: 'Delete user', icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete', rejectLabel: 'Cancel',
      accept: () => {
        const localDelete = () => {
          this.users = this.users.filter(u => u.id !== user.id);
          this.applyFilter();
          this.msg.add({ severity: 'success', summary: 'Deleted', detail: `${user.name} removed.` });
          this.cdr.markForCheck();
        };
        if (!this.api) { localDelete(); return; }
        this.http.delete(`${this.api}/${user.id}`).pipe(catchError(() => of(null)))
          .subscribe(() => localDelete());
      }
    });
  }

  // ── Table Export Capabilities ─────────────────────────────────────────────
  exportExcel(): void {
    const headers = ['S.No', 'Name', 'Email', 'Role', 'District / Division', 'App Access', 'Status'];
    const rows = this.filteredUsers.map((u, i) => [
      i + 1,
      `"${u.name}"`,
      `"${u.email}"`,
      `"${this.roleLabel(u.role)}"`,
      `"${u.districtName || u.divisionName || 'All'}"`,
      `"${u.appAccess?.join(', ') || ''}"`,
      `"${u.isActive ? 'Active' : 'Inactive'}"`
    ]);
    const content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TAHDCO_User_Master_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportCSV(): void {
    const headers = ['S.No', 'Name', 'Email', 'Role', 'District/Division', 'App Access', 'Status'];
    const rows = this.filteredUsers.map((u, i) => [
      i + 1,
      `"${u.name}"`,
      `"${u.email}"`,
      `"${this.roleLabel(u.role)}"`,
      `"${u.districtName || u.divisionName || 'All'}"`,
      `"${u.appAccess?.join(', ') || ''}"`,
      `"${u.isActive ? 'Active' : 'Inactive'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TAHDCO_User_Master_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  copyToClipboard(): void {
    const text = this.filteredUsers.map((u, i) => `${i + 1}. ${u.name} | ${u.email} | ${this.roleLabel(u.role)} | ${u.districtName || u.divisionName || 'All'} | ${u.isActive ? 'Active' : 'Inactive'}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.msg.add({ severity: 'success', summary: 'Copied', detail: 'User list copied to clipboard!' });
    });
  }

  printTable(): void {
    window.print();
  }

  get activeCount(): number { return this.users.filter(u => u.isActive).length; }
}
