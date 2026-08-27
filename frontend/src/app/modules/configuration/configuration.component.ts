import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { catchError, of } from 'rxjs';
import * as XLSX from 'xlsx';
import { environment } from '../../../environments/environment';
import { AppRole, AppProject, ProjectMapping, Role, ROLE_META, User, ProjectPrivilege } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';

export interface LocalBodyMapping {
  id?: number;
  sno?: number;
  state?: string;
  division?: string;
  district?: string;
  localBody?: string;
  localBodyName?: string;
  block?: string;
  villagePanchayat?: string;
  corporation?: string;
  townPanchayat?: string;
  municipality?: string;
  gcc?: string;
  cmwssb?: string;
}

@Component({
  selector: 'app-configuration',
  templateUrl: './configuration.component.html',
  styleUrls: ['./configuration.component.scss'],
  providers: [MessageService, ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfigurationComponent implements OnInit {
  activeTabIndex = 0;

  // ── Tab 0: Role Management ────────────────────────────────────────────────
  roles: AppRole[] = [];
  filteredRoles: AppRole[] = [];
  roleSearch = '';
  roleLoading = false;
  roleModalVisible = false;
  isRoleEditing = false;
  currentRole: AppRole = { roleCode: '', roleName: '', scope: 'all', isActive: true, assignedProjects: [] };

  scopeOptions = [
    { label: 'All State / Corporation Wide (all)', value: 'all' },
    { label: 'Division Specific (division)', value: 'division' },
    { label: 'District Specific (district)', value: 'district' }
  ];

  roleOptions = [
    { label: 'All Roles', value: '' },
    { label: 'Application Admin (admin)', value: 'admin' },
    { label: 'Managing Director (md)', value: 'md' },
    { label: 'Secretary (secretary)', value: 'secretary' },
    { label: 'Chief Engineer (ce)', value: 'ce' },
    { label: 'General Manager (gm)', value: 'gm' },
    { label: 'Executive Engineer (ee)', value: 'ee' },
    { label: 'District Manager (dm)', value: 'dm' },
    { label: 'Engineering Lead (eng_lead)', value: 'eng_lead' },
    { label: 'Welfare Officer (welfare_officer)', value: 'welfare_officer' },
    { label: 'TNCWWN Coordinator (tncwwn_coord)', value: 'tncwwn_coord' }
  ];

  // ── Tab 1: Project Name Creation & Management ────────────────────────────
  projects: AppProject[] = [];
  filteredProjects: AppProject[] = [];
  projectSearch = '';
  projectCategoryFilter = 'All';
  projectLoading = false;
  projectModalVisible = false;
  isProjectEditing = false;
  currentProject: AppProject = { projectCode: '', projectName: '', category: 'Engineering', status: 'Active', isActive: true, icon: 'pi-wrench' };

  categoryOptions = [
    { label: 'All Categories', value: 'All' },
    { label: 'Engineering', value: 'Engineering' },
    { label: 'Welfare', value: 'Welfare' },
    { label: 'Welfare Board', value: 'Welfare Board' },
    { label: 'Monitoring', value: 'Monitoring' },
    { label: 'Operations', value: 'Operations' },
    { label: 'Unified Dashboard', value: 'Unified Dashboard' }
  ];

  projectStatusOptions = [
    { label: 'Active', value: 'Active' },
    { label: 'Inactive', value: 'Inactive' },
    { label: 'Maintenance', value: 'Maintenance' }
  ];

  iconOptions = [
    { label: 'Wrench / Engineering (pi-wrench)', value: 'pi-wrench' },
    { label: 'Heart / Welfare (pi-heart)', value: 'pi-heart' },
    { label: 'ID Card / TNCWWB (pi-id-card)', value: 'pi-id-card' },
    { label: 'Tender / TIPS (pi-file-edit)', value: 'pi-file-edit' },
    { label: 'Clock / TIME (pi-clock)', value: 'pi-clock' },
    { label: 'Building / THMS (pi-building)', value: 'pi-building' },
    { label: 'Graduation / TAMS (pi-graduation-cap)', value: 'pi-graduation-cap' },
    { label: 'Wallet / Schemes (pi-wallet)', value: 'pi-wallet' },
    { label: 'Book / Loans (pi-book)', value: 'pi-book' },
    { label: 'Calendar / TOD (pi-calendar)', value: 'pi-calendar' },
    { label: 'Video / Patrol 360 (pi-video)', value: 'pi-video' },
    { label: 'Grid / One Portal (pi-th-large)', value: 'pi-th-large' },
    { label: 'Folder / Generic (pi-folder)', value: 'pi-folder' }
  ];

  // ── Tab 2: Project Mapping (User / Role to Project) ────────────────────────
  mappings: ProjectMapping[] = [];
  filteredMappings: ProjectMapping[] = [];
  mappingSearch = '';
  mappingTypeFilter = 'ALL';
  mappingProjectFilter = 'ALL';
  mappingLoading = false;
  mappingModalVisible = false;
  isMappingEditing = false;
  currentMapping: ProjectMapping = {
    mappingType: 'ROLE',
    entityCode: '',
    entityName: '',
    projectCode: '',
    projectName: '',
    canView: true,
    canCreate: false,
    canEdit: false,
    canUpdate: false,
    canDelete: false,
    status: 'Active'
  };

  mappingTypeOptions = [
    { label: 'All Mapping Types', value: 'ALL' },
    { label: 'Role Mappings', value: 'ROLE' },
    { label: 'User Mappings', value: 'USER' }
  ];

  // ── Tab 3: User Privilege Function & Permission Matrix ────────────────────
  usersList: User[] = [];
  filteredUsersList: User[] = [];
  userSearch = '';
  userRoleFilter = '';
  userPrivilegeLoading = false;
  privActions: (keyof ProjectPrivilege)[] = ['view', 'create', 'edit', 'update', 'delete'];
  projectKeys: string[] = ['Engineering', 'Welfare', 'TNCWWN', 'TIPS', 'TIME', 'THMS', 'TAMS', 'Scheme', 'TELP', 'OnePortal', 'TOD', 'Patrol360'];

  // ── Tab 4: Local Body Configuration ──────────────────────────────────────
  records: LocalBodyMapping[] = [];
  filteredRecords: LocalBodyMapping[] = [];
  loading = false;
  uploading = false;
  searchTerm = '';
  selectedDivision = '';
  selectedDistrict = '';
  selectedType = '';
  first = 0;
  rows = 15;

  // Modal State
  displayModal = false;
  isEditing = false;
  currentRecord: LocalBodyMapping = {};

  divisions: { label: string; value: string }[] = [
    { label: 'All Divisions', value: '' },
    { label: 'Chennai', value: 'Chennai' },
    { label: 'Coimbatore', value: 'Coimbatore' },
    { label: 'Madurai', value: 'Madurai' },
    { label: 'Salem', value: 'Salem' },
    { label: 'Thanjavur', value: 'Thanjavur' },
    { label: 'Tirunelveli', value: 'Tirunelveli' },
    { label: 'Trichy', value: 'Trichy' },
    { label: 'Vellore', value: 'Vellore' },
    { label: 'Villupuram', value: 'Villupuram' }
  ];

  districts: { label: string; value: string }[] = [
    { label: 'All Districts', value: '' },
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
    { label: 'Sivaganga', value: 'Sivaganga' },
    { label: 'Tenkasi', value: 'Tenkasi' },
    { label: 'Thanjavur', value: 'Thanjavur' },
    { label: 'The Nilgiris', value: 'The Nilgiris' },
    { label: 'Theni', value: 'Theni' },
    { label: 'Thiruchirappalli', value: 'Thiruchirappalli' },
    { label: 'Thirunelveli', value: 'Thirunelveli' },
    { label: 'Thiruvallur', value: 'Thiruvallur' },
    { label: 'Thiruvannamalai', value: 'Thiruvannamalai' },
    { label: 'Thiruvarur', value: 'Thiruvarur' },
    { label: 'Thoothukudi', value: 'Thoothukudi' },
    { label: 'Tirupathur', value: 'Tirupathur' },
    { label: 'Tiruppur', value: 'Tiruppur' },
    { label: 'Vellore', value: 'Vellore' },
    { label: 'Villupuram', value: 'Villupuram' },
    { label: 'Virudhunagar', value: 'Virudhunagar' }
  ];

  localBodyTypes: { label: string; value: string }[] = [
    { label: 'All Types', value: '' },
    { label: 'Corporation', value: 'Corporation' },
    { label: 'Municipality', value: 'Municipality' },
    { label: 'Town Panchayat', value: 'Town Panchayat' },
    { label: 'Village Panchayat', value: 'Village Panchayat' }
  ];

  private readonly STORAGE_KEY = 'TAHDCO_LOCAL_BODY_CONFIG';
  private api = environment.apiUrl ? `${environment.apiUrl}/api/v1/configuration` : '';

  // Baseline Initial Seed Data for all 38 Districts of Tamil Nadu (Multi-tier: Corporation, Municipality, Town Panchayat, Block, Village Panchayat)
  private readonly defaultSeed: LocalBodyMapping[] = [
    // 1. Ariyalur (Trichy)
    { id: 1, sno: 1, state: 'Tamil Nadu', division: 'Trichy', district: 'Ariyalur', localBody: 'Municipality', localBodyName: 'Ariyalur Municipality', block: 'Ariyalur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Ariyalur', gcc: '-', cmwssb: '-' },
    { id: 2, sno: 2, state: 'Tamil Nadu', division: 'Trichy', district: 'Ariyalur', localBody: 'Municipality', localBodyName: 'Jayankondam Municipality', block: 'Jayankondam Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Jayankondam', gcc: '-', cmwssb: '-' },
    { id: 3, sno: 3, state: 'Tamil Nadu', division: 'Trichy', district: 'Ariyalur', localBody: 'Town Panchayat', localBodyName: 'Varadarajanpettai Town Panchayat', block: 'Andimadam Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Varadarajanpettai', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 4, sno: 4, state: 'Tamil Nadu', division: 'Trichy', district: 'Ariyalur', localBody: 'Village Panchayat', localBodyName: 'Kallankurichi Village Panchayat', block: 'Ariyalur Block', villagePanchayat: 'Kallankurichi', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 5, sno: 5, state: 'Tamil Nadu', division: 'Trichy', district: 'Ariyalur', localBody: 'Village Panchayat', localBodyName: 'T.Palur Village Panchayat', block: 'T.Palur Block', villagePanchayat: 'T.Palur', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 2. Chengalpattu (Chennai)
    { id: 6, sno: 6, state: 'Tamil Nadu', division: 'Chennai', district: 'Chengalpattu', localBody: 'Corporation', localBodyName: 'Tambaram City Municipal Corporation', block: 'St. Thomas Mount Block', villagePanchayat: '-', corporation: 'Tambaram', townPanchayat: '-', municipality: 'Tambaram', gcc: '-', cmwssb: '-' },
    { id: 7, sno: 7, state: 'Tamil Nadu', division: 'Chennai', district: 'Chengalpattu', localBody: 'Municipality', localBodyName: 'Chengalpattu Municipality', block: 'Chengalpattu Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Chengalpattu', gcc: '-', cmwssb: '-' },
    { id: 8, sno: 8, state: 'Tamil Nadu', division: 'Chennai', district: 'Chengalpattu', localBody: 'Municipality', localBodyName: 'Maraimalai Nagar Municipality', block: 'Kattankulathur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Maraimalai Nagar', gcc: '-', cmwssb: '-' },
    { id: 9, sno: 9, state: 'Tamil Nadu', division: 'Chennai', district: 'Chengalpattu', localBody: 'Town Panchayat', localBodyName: 'Thiruporur Town Panchayat', block: 'Thiruporur Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Thiruporur', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 10, sno: 10, state: 'Tamil Nadu', division: 'Chennai', district: 'Chengalpattu', localBody: 'Town Panchayat', localBodyName: 'Mamallapuram Town Panchayat', block: 'Thirukalukundram Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Mamallapuram', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 11, sno: 11, state: 'Tamil Nadu', division: 'Chennai', district: 'Chengalpattu', localBody: 'Village Panchayat', localBodyName: 'Alapakkam Village Panchayat', block: 'Chengalpattu Block', villagePanchayat: 'Alapakkam', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 3. Chennai (Chennai)
    { id: 12, sno: 12, state: 'Tamil Nadu', division: 'Chennai', district: 'Chennai', localBody: 'Corporation', localBodyName: 'Greater Chennai Corporation - North (Zones 1-5)', block: 'Royapuram / Tondiarpet Block', villagePanchayat: '-', corporation: 'GCC', townPanchayat: '-', municipality: '-', gcc: 'Yes', cmwssb: 'Yes' },
    { id: 13, sno: 13, state: 'Tamil Nadu', division: 'Chennai', district: 'Chennai', localBody: 'Corporation', localBodyName: 'Greater Chennai Corporation - Central (Zones 6-10)', block: 'Anna Nagar / Teynampet Block', villagePanchayat: '-', corporation: 'GCC', townPanchayat: '-', municipality: '-', gcc: 'Yes', cmwssb: 'Yes' },
    { id: 14, sno: 14, state: 'Tamil Nadu', division: 'Chennai', district: 'Chennai', localBody: 'Corporation', localBodyName: 'Greater Chennai Corporation - South (Zones 11-15)', block: 'Adyar / Sholinganallur Block', villagePanchayat: '-', corporation: 'GCC', townPanchayat: '-', municipality: '-', gcc: 'Yes', cmwssb: 'Yes' },
    { id: 15, sno: 15, state: 'Tamil Nadu', division: 'Chennai', district: 'Chennai', localBody: 'Municipality', localBodyName: 'Alandur Urban Zone', block: 'Alandur Block', villagePanchayat: '-', corporation: 'GCC', townPanchayat: '-', municipality: 'Alandur', gcc: 'Yes', cmwssb: 'Yes' },

    // 4. Coimbatore (Coimbatore)
    { id: 16, sno: 16, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Coimbatore', localBody: 'Corporation', localBodyName: 'Coimbatore City Municipal Corporation', block: 'Coimbatore North & South Block', villagePanchayat: '-', corporation: 'Coimbatore', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 17, sno: 17, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Coimbatore', localBody: 'Municipality', localBodyName: 'Pollachi Municipality', block: 'Pollachi Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Pollachi', gcc: '-', cmwssb: '-' },
    { id: 18, sno: 18, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Coimbatore', localBody: 'Municipality', localBodyName: 'Mettupalayam Municipality', block: 'Karamadai Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Mettupalayam', gcc: '-', cmwssb: '-' },
    { id: 19, sno: 19, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Coimbatore', localBody: 'Town Panchayat', localBodyName: 'Annur Town Panchayat', block: 'Annur Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Annur', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 20, sno: 20, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Coimbatore', localBody: 'Town Panchayat', localBodyName: 'Sulur Town Panchayat', block: 'Sulur Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Sulur', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 21, sno: 21, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Coimbatore', localBody: 'Village Panchayat', localBodyName: 'Madukkarai Village Panchayat', block: 'Madukkarai Block', villagePanchayat: 'Madukkarai', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 5. Cuddalore (Villupuram)
    { id: 22, sno: 22, state: 'Tamil Nadu', division: 'Villupuram', district: 'Cuddalore', localBody: 'Corporation', localBodyName: 'Cuddalore City Municipal Corporation', block: 'Cuddalore Block', villagePanchayat: '-', corporation: 'Cuddalore', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 23, sno: 23, state: 'Tamil Nadu', division: 'Villupuram', district: 'Cuddalore', localBody: 'Municipality', localBodyName: 'Panruti Municipality', block: 'Panruti Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Panruti', gcc: '-', cmwssb: '-' },
    { id: 24, sno: 24, state: 'Tamil Nadu', division: 'Villupuram', district: 'Cuddalore', localBody: 'Municipality', localBodyName: 'Chidambaram Municipality', block: 'Parangipettai Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Chidambaram', gcc: '-', cmwssb: '-' },
    { id: 25, sno: 25, state: 'Tamil Nadu', division: 'Villupuram', district: 'Cuddalore', localBody: 'Town Panchayat', localBodyName: 'Kurinjipadi Town Panchayat', block: 'Kurinjipadi Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Kurinjipadi', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 26, sno: 26, state: 'Tamil Nadu', division: 'Villupuram', district: 'Cuddalore', localBody: 'Village Panchayat', localBodyName: 'Sedapalayam Village Panchayat', block: 'Cuddalore Block', villagePanchayat: 'Sedapalayam', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 6. Dharmapuri (Salem)
    { id: 27, sno: 27, state: 'Tamil Nadu', division: 'Salem', district: 'Dharmapuri', localBody: 'Municipality', localBodyName: 'Dharmapuri Municipality', block: 'Dharmapuri Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Dharmapuri', gcc: '-', cmwssb: '-' },
    { id: 28, sno: 28, state: 'Tamil Nadu', division: 'Salem', district: 'Dharmapuri', localBody: 'Town Panchayat', localBodyName: 'Harur Town Panchayat', block: 'Harur Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Harur', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 29, sno: 29, state: 'Tamil Nadu', division: 'Salem', district: 'Dharmapuri', localBody: 'Town Panchayat', localBodyName: 'Palakkodu Town Panchayat', block: 'Palakkodu Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Palakkodu', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 30, sno: 30, state: 'Tamil Nadu', division: 'Salem', district: 'Dharmapuri', localBody: 'Town Panchayat', localBodyName: 'Pennagaram Town Panchayat', block: 'Pennagaram Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Pennagaram', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 31, sno: 31, state: 'Tamil Nadu', division: 'Salem', district: 'Dharmapuri', localBody: 'Village Panchayat', localBodyName: 'Adagapadi Village Panchayat', block: 'Dharmapuri Block', villagePanchayat: 'Adagapadi', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 7. Dindigul (Madurai)
    { id: 32, sno: 32, state: 'Tamil Nadu', division: 'Madurai', district: 'Dindigul', localBody: 'Corporation', localBodyName: 'Dindigul City Corporation', block: 'Dindigul Block', villagePanchayat: '-', corporation: 'Dindigul', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 33, sno: 33, state: 'Tamil Nadu', division: 'Madurai', district: 'Dindigul', localBody: 'Municipality', localBodyName: 'Palani Municipality', block: 'Palani Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Palani', gcc: '-', cmwssb: '-' },
    { id: 34, sno: 34, state: 'Tamil Nadu', division: 'Madurai', district: 'Dindigul', localBody: 'Municipality', localBodyName: 'Kodaikanal Municipality', block: 'Kodaikanal Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Kodaikanal', gcc: '-', cmwssb: '-' },
    { id: 35, sno: 35, state: 'Tamil Nadu', division: 'Madurai', district: 'Dindigul', localBody: 'Town Panchayat', localBodyName: 'Natham Town Panchayat', block: 'Natham Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Natham', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 36, sno: 36, state: 'Tamil Nadu', division: 'Madurai', district: 'Dindigul', localBody: 'Village Panchayat', localBodyName: 'Adiyanuthu Village Panchayat', block: 'Dindigul Block', villagePanchayat: 'Adiyanuthu', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 8. Erode (Coimbatore)
    { id: 37, sno: 37, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Erode', localBody: 'Corporation', localBodyName: 'Erode City Municipal Corporation', block: 'Erode Block', villagePanchayat: '-', corporation: 'Erode', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 38, sno: 38, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Erode', localBody: 'Municipality', localBodyName: 'Gobichettipalayam Municipality', block: 'Gobichettipalayam Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Gobichettipalayam', gcc: '-', cmwssb: '-' },
    { id: 39, sno: 39, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Erode', localBody: 'Municipality', localBodyName: 'Bhavani Municipality', block: 'Bhavani Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Bhavani', gcc: '-', cmwssb: '-' },
    { id: 40, sno: 40, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Erode', localBody: 'Town Panchayat', localBodyName: 'Perundurai Town Panchayat', block: 'Perundurai Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Perundurai', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 41, sno: 41, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Erode', localBody: 'Village Panchayat', localBodyName: 'Vaikkalmedu Village Panchayat', block: 'Modakkurichi Block', villagePanchayat: 'Vaikkalmedu', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 9. Kallakurichi (Villupuram)
    { id: 42, sno: 42, state: 'Tamil Nadu', division: 'Villupuram', district: 'Kallakurichi', localBody: 'Municipality', localBodyName: 'Kallakurichi Municipality', block: 'Kallakurichi Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Kallakurichi', gcc: '-', cmwssb: '-' },
    { id: 43, sno: 43, state: 'Tamil Nadu', division: 'Villupuram', district: 'Kallakurichi', localBody: 'Municipality', localBodyName: 'Ulundurpet Municipality', block: 'Ulundurpet Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Ulundurpet', gcc: '-', cmwssb: '-' },
    { id: 44, sno: 44, state: 'Tamil Nadu', division: 'Villupuram', district: 'Kallakurichi', localBody: 'Town Panchayat', localBodyName: 'Sankarapuram Town Panchayat', block: 'Sankarapuram Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Sankarapuram', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 45, sno: 45, state: 'Tamil Nadu', division: 'Villupuram', district: 'Kallakurichi', localBody: 'Town Panchayat', localBodyName: 'Chinnasalem Town Panchayat', block: 'Chinnasalem Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Chinnasalem', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 46, sno: 46, state: 'Tamil Nadu', division: 'Villupuram', district: 'Kallakurichi', localBody: 'Village Panchayat', localBodyName: 'Alathur Village Panchayat', block: 'Kallakurichi Block', villagePanchayat: 'Alathur', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 10. Kancheepuram (Chennai)
    { id: 47, sno: 47, state: 'Tamil Nadu', division: 'Chennai', district: 'Kancheepuram', localBody: 'Corporation', localBodyName: 'Kancheepuram City Corporation', block: 'Kancheepuram Block', villagePanchayat: '-', corporation: 'Kancheepuram', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 48, sno: 48, state: 'Tamil Nadu', division: 'Chennai', district: 'Kancheepuram', localBody: 'Municipality', localBodyName: 'Kundrathur Municipality', block: 'Kundrathur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Kundrathur', gcc: '-', cmwssb: '-' },
    { id: 49, sno: 49, state: 'Tamil Nadu', division: 'Chennai', district: 'Kancheepuram', localBody: 'Municipality', localBodyName: 'Mangadu Municipality', block: 'Mangadu Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Mangadu', gcc: '-', cmwssb: '-' },
    { id: 50, sno: 50, state: 'Tamil Nadu', division: 'Chennai', district: 'Kancheepuram', localBody: 'Town Panchayat', localBodyName: 'Walajabad Town Panchayat', block: 'Walajabad Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Walajabad', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 51, sno: 51, state: 'Tamil Nadu', division: 'Chennai', district: 'Kancheepuram', localBody: 'Village Panchayat', localBodyName: 'Damal Village Panchayat', block: 'Kancheepuram Block', villagePanchayat: 'Damal', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 11. Kanniyakumari (Tirunelveli)
    { id: 52, sno: 52, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Kanniyakumari', localBody: 'Corporation', localBodyName: 'Nagercoil City Corporation', block: 'Agastheeswaram Block', villagePanchayat: '-', corporation: 'Nagercoil', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 53, sno: 53, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Kanniyakumari', localBody: 'Municipality', localBodyName: 'Padmanabhapuram Municipality', block: 'Thuckalay Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Padmanabhapuram', gcc: '-', cmwssb: '-' },
    { id: 54, sno: 54, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Kanniyakumari', localBody: 'Municipality', localBodyName: 'Colachel Municipality', block: 'Kurunthencode Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Colachel', gcc: '-', cmwssb: '-' },
    { id: 55, sno: 55, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Kanniyakumari', localBody: 'Town Panchayat', localBodyName: 'Kanyakumari Town Panchayat', block: 'Agastheeswaram Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Kanyakumari', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 56, sno: 56, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Kanniyakumari', localBody: 'Village Panchayat', localBodyName: 'Suchindram Village Panchayat', block: 'Agastheeswaram Block', villagePanchayat: 'Suchindram', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 12. Karur (Trichy)
    { id: 57, sno: 57, state: 'Tamil Nadu', division: 'Trichy', district: 'Karur', localBody: 'Corporation', localBodyName: 'Karur City Municipal Corporation', block: 'Karur Block', villagePanchayat: '-', corporation: 'Karur', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 58, sno: 58, state: 'Tamil Nadu', division: 'Trichy', district: 'Karur', localBody: 'Municipality', localBodyName: 'Kulithalai Municipality', block: 'Kulithalai Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Kulithalai', gcc: '-', cmwssb: '-' },
    { id: 59, sno: 59, state: 'Tamil Nadu', division: 'Trichy', district: 'Karur', localBody: 'Town Panchayat', localBodyName: 'Aravakurichi Town Panchayat', block: 'Aravakurichi Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Aravakurichi', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 60, sno: 60, state: 'Tamil Nadu', division: 'Trichy', district: 'Karur', localBody: 'Town Panchayat', localBodyName: 'Pallapatti Town Panchayat', block: 'Pallapatti Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Pallapatti', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 61, sno: 61, state: 'Tamil Nadu', division: 'Trichy', district: 'Karur', localBody: 'Village Panchayat', localBodyName: 'Andankoil Village Panchayat', block: 'Thanthoni Block', villagePanchayat: 'Andankoil', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 13. Krishnagiri (Salem)
    { id: 62, sno: 62, state: 'Tamil Nadu', division: 'Salem', district: 'Krishnagiri', localBody: 'Corporation', localBodyName: 'Hosur City Municipal Corporation', block: 'Hosur Block', villagePanchayat: '-', corporation: 'Hosur', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 63, sno: 63, state: 'Tamil Nadu', division: 'Salem', district: 'Krishnagiri', localBody: 'Municipality', localBodyName: 'Krishnagiri Municipality', block: 'Krishnagiri Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Krishnagiri', gcc: '-', cmwssb: '-' },
    { id: 64, sno: 64, state: 'Tamil Nadu', division: 'Salem', district: 'Krishnagiri', localBody: 'Town Panchayat', localBodyName: 'Uthangarai Town Panchayat', block: 'Uthangarai Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Uthangarai', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 65, sno: 65, state: 'Tamil Nadu', division: 'Salem', district: 'Krishnagiri', localBody: 'Town Panchayat', localBodyName: 'Kaveripattinam Town Panchayat', block: 'Kaveripattinam Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Kaveripattinam', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 66, sno: 66, state: 'Tamil Nadu', division: 'Salem', district: 'Krishnagiri', localBody: 'Village Panchayat', localBodyName: 'Mathigiri Village Panchayat', block: 'Hosur Block', villagePanchayat: 'Mathigiri', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 14. Madurai (Madurai)
    { id: 67, sno: 67, state: 'Tamil Nadu', division: 'Madurai', district: 'Madurai', localBody: 'Corporation', localBodyName: 'Madurai City Municipal Corporation', block: 'Madurai East & West Block', villagePanchayat: '-', corporation: 'Madurai', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 68, sno: 68, state: 'Tamil Nadu', division: 'Madurai', district: 'Madurai', localBody: 'Municipality', localBodyName: 'Melur Municipality', block: 'Melur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Melur', gcc: '-', cmwssb: '-' },
    { id: 69, sno: 69, state: 'Tamil Nadu', division: 'Madurai', district: 'Madurai', localBody: 'Municipality', localBodyName: 'Thirumangalam Municipality', block: 'Thirumangalam Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Thirumangalam', gcc: '-', cmwssb: '-' },
    { id: 70, sno: 70, state: 'Tamil Nadu', division: 'Madurai', district: 'Madurai', localBody: 'Town Panchayat', localBodyName: 'Vadipatti Town Panchayat', block: 'Vadipatti Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Vadipatti', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 71, sno: 71, state: 'Tamil Nadu', division: 'Madurai', district: 'Madurai', localBody: 'Village Panchayat', localBodyName: 'Othakadai Village Panchayat', block: 'Madurai East Block', villagePanchayat: 'Othakadai', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 15. Mayiladuthurai (Thanjavur)
    { id: 72, sno: 72, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Mayiladuthurai', localBody: 'Municipality', localBodyName: 'Mayiladuthurai Municipality', block: 'Mayiladuthurai Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Mayiladuthurai', gcc: '-', cmwssb: '-' },
    { id: 73, sno: 73, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Mayiladuthurai', localBody: 'Municipality', localBodyName: 'Sirkazhi Municipality', block: 'Sirkazhi Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Sirkazhi', gcc: '-', cmwssb: '-' },
    { id: 74, sno: 74, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Mayiladuthurai', localBody: 'Town Panchayat', localBodyName: 'Tharangambadi Town Panchayat', block: 'Tharangambadi Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Tharangambadi', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 75, sno: 75, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Mayiladuthurai', localBody: 'Town Panchayat', localBodyName: 'Vaitheeswarankoil Town Panchayat', block: 'Kollidam Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Vaitheeswarankoil', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 76, sno: 76, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Mayiladuthurai', localBody: 'Village Panchayat', localBodyName: 'Kuthalam Village Panchayat', block: 'Kuthalam Block', villagePanchayat: 'Kuthalam', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 16. Nagapattinam (Thanjavur)
    { id: 77, sno: 77, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Nagapattinam', localBody: 'Municipality', localBodyName: 'Nagapattinam Municipality', block: 'Nagapattinam Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Nagapattinam', gcc: '-', cmwssb: '-' },
    { id: 78, sno: 78, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Nagapattinam', localBody: 'Municipality', localBodyName: 'Vedaranyam Municipality', block: 'Vedaranyam Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Vedaranyam', gcc: '-', cmwssb: '-' },
    { id: 79, sno: 79, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Nagapattinam', localBody: 'Town Panchayat', localBodyName: 'Kilvelur Town Panchayat', block: 'Kilvelur Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Kilvelur', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 80, sno: 80, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Nagapattinam', localBody: 'Town Panchayat', localBodyName: 'Velankanni Town Panchayat', block: 'Keelaiyur Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Velankanni', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 81, sno: 81, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Nagapattinam', localBody: 'Village Panchayat', localBodyName: 'Sikkal Village Panchayat', block: 'Nagapattinam Block', villagePanchayat: 'Sikkal', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 17. Namakkal (Salem)
    { id: 82, sno: 82, state: 'Tamil Nadu', division: 'Salem', district: 'Namakkal', localBody: 'Municipality', localBodyName: 'Namakkal Municipality', block: 'Namakkal Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Namakkal', gcc: '-', cmwssb: '-' },
    { id: 83, sno: 83, state: 'Tamil Nadu', division: 'Salem', district: 'Namakkal', localBody: 'Municipality', localBodyName: 'Tiruchengode Municipality', block: 'Tiruchengode Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Tiruchengode', gcc: '-', cmwssb: '-' },
    { id: 84, sno: 84, state: 'Tamil Nadu', division: 'Salem', district: 'Namakkal', localBody: 'Municipality', localBodyName: 'Rasipuram Municipality', block: 'Rasipuram Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Rasipuram', gcc: '-', cmwssb: '-' },
    { id: 85, sno: 85, state: 'Tamil Nadu', division: 'Salem', district: 'Namakkal', localBody: 'Town Panchayat', localBodyName: 'Paramathi Town Panchayat', block: 'Paramathi Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Paramathi', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 86, sno: 86, state: 'Tamil Nadu', division: 'Salem', district: 'Namakkal', localBody: 'Village Panchayat', localBodyName: 'Vengarai Village Panchayat', block: 'Mohanur Block', villagePanchayat: 'Vengarai', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 18. Perambalur (Trichy)
    { id: 87, sno: 87, state: 'Tamil Nadu', division: 'Trichy', district: 'Perambalur', localBody: 'Municipality', localBodyName: 'Perambalur Municipality', block: 'Perambalur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Perambalur', gcc: '-', cmwssb: '-' },
    { id: 88, sno: 88, state: 'Tamil Nadu', division: 'Trichy', district: 'Perambalur', localBody: 'Town Panchayat', localBodyName: 'Kurumbalur Town Panchayat', block: 'Perambalur Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Kurumbalur', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 89, sno: 89, state: 'Tamil Nadu', division: 'Trichy', district: 'Perambalur', localBody: 'Town Panchayat', localBodyName: 'Labbaikudikadu Town Panchayat', block: 'Kunnam Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Labbaikudikadu', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 90, sno: 90, state: 'Tamil Nadu', division: 'Trichy', district: 'Perambalur', localBody: 'Village Panchayat', localBodyName: 'Elambalur Village Panchayat', block: 'Perambalur Block', villagePanchayat: 'Elambalur', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 91, sno: 91, state: 'Tamil Nadu', division: 'Trichy', district: 'Perambalur', localBody: 'Village Panchayat', localBodyName: 'Veppanthattai Village Panchayat', block: 'Veppanthattai Block', villagePanchayat: 'Veppanthattai', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 19. Pudukkottai (Trichy)
    { id: 92, sno: 92, state: 'Tamil Nadu', division: 'Trichy', district: 'Pudukkottai', localBody: 'Corporation', localBodyName: 'Pudukkottai Corporation', block: 'Pudukkottai Block', villagePanchayat: '-', corporation: 'Pudukkottai', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 93, sno: 93, state: 'Tamil Nadu', division: 'Trichy', district: 'Pudukkottai', localBody: 'Municipality', localBodyName: 'Aranthangi Municipality', block: 'Aranthangi Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Aranthangi', gcc: '-', cmwssb: '-' },
    { id: 94, sno: 94, state: 'Tamil Nadu', division: 'Trichy', district: 'Pudukkottai', localBody: 'Town Panchayat', localBodyName: 'Alangudi Town Panchayat', block: 'Alangudi Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Alangudi', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 95, sno: 95, state: 'Tamil Nadu', division: 'Trichy', district: 'Pudukkottai', localBody: 'Town Panchayat', localBodyName: 'Illuppur Town Panchayat', block: 'Illuppur Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Illuppur', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 96, sno: 96, state: 'Tamil Nadu', division: 'Trichy', district: 'Pudukkottai', localBody: 'Village Panchayat', localBodyName: 'Mullur Village Panchayat', block: 'Pudukkottai Block', villagePanchayat: 'Mullur', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 20. Ramanathapuram (Madurai)
    { id: 97, sno: 97, state: 'Tamil Nadu', division: 'Madurai', district: 'Ramanathapuram', localBody: 'Municipality', localBodyName: 'Ramanathapuram Municipality', block: 'Ramanathapuram Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Ramanathapuram', gcc: '-', cmwssb: '-' },
    { id: 98, sno: 98, state: 'Tamil Nadu', division: 'Madurai', district: 'Ramanathapuram', localBody: 'Municipality', localBodyName: 'Paramakudi Municipality', block: 'Paramakudi Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Paramakudi', gcc: '-', cmwssb: '-' },
    { id: 99, sno: 99, state: 'Tamil Nadu', division: 'Madurai', district: 'Ramanathapuram', localBody: 'Town Panchayat', localBodyName: 'Rameswaram Town Panchayat', block: 'Mandapam Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Rameswaram', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 100, sno: 100, state: 'Tamil Nadu', division: 'Madurai', district: 'Ramanathapuram', localBody: 'Town Panchayat', localBodyName: 'Kamuthi Town Panchayat', block: 'Kamuthi Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Kamuthi', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 101, sno: 101, state: 'Tamil Nadu', division: 'Madurai', district: 'Ramanathapuram', localBody: 'Village Panchayat', localBodyName: 'Devipattinam Village Panchayat', block: 'Ramanathapuram Block', villagePanchayat: 'Devipattinam', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 21. Ranipet (Vellore)
    { id: 102, sno: 102, state: 'Tamil Nadu', division: 'Vellore', district: 'Ranipet', localBody: 'Municipality', localBodyName: 'Ranipet Municipality', block: 'Walajah Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Ranipet', gcc: '-', cmwssb: '-' },
    { id: 103, sno: 103, state: 'Tamil Nadu', division: 'Vellore', district: 'Ranipet', localBody: 'Municipality', localBodyName: 'Arakkonam Municipality', block: 'Arakkonam Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Arakkonam', gcc: '-', cmwssb: '-' },
    { id: 104, sno: 104, state: 'Tamil Nadu', division: 'Vellore', district: 'Ranipet', localBody: 'Municipality', localBodyName: 'Arcot Municipality', block: 'Arcot Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Arcot', gcc: '-', cmwssb: '-' },
    { id: 105, sno: 105, state: 'Tamil Nadu', division: 'Vellore', district: 'Ranipet', localBody: 'Town Panchayat', localBodyName: 'Kaveripakkam Town Panchayat', block: 'Nemili Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Kaveripakkam', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 106, sno: 106, state: 'Tamil Nadu', division: 'Vellore', district: 'Ranipet', localBody: 'Village Panchayat', localBodyName: 'Ammoor Village Panchayat', block: 'Walajah Block', villagePanchayat: 'Ammoor', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 22. Salem (Salem)
    { id: 107, sno: 107, state: 'Tamil Nadu', division: 'Salem', district: 'Salem', localBody: 'Corporation', localBodyName: 'Salem City Municipal Corporation', block: 'Salem Urban Block', villagePanchayat: '-', corporation: 'Salem', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 108, sno: 108, state: 'Tamil Nadu', division: 'Salem', district: 'Salem', localBody: 'Municipality', localBodyName: 'Attur Municipality', block: 'Attur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Attur', gcc: '-', cmwssb: '-' },
    { id: 109, sno: 109, state: 'Tamil Nadu', division: 'Salem', district: 'Salem', localBody: 'Municipality', localBodyName: 'Mettur Municipality', block: 'Mettur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Mettur', gcc: '-', cmwssb: '-' },
    { id: 110, sno: 110, state: 'Tamil Nadu', division: 'Salem', district: 'Salem', localBody: 'Town Panchayat', localBodyName: 'Jalakandapuram Town Panchayat', block: 'Mecheri Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Jalakandapuram', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 111, sno: 111, state: 'Tamil Nadu', division: 'Salem', district: 'Salem', localBody: 'Village Panchayat', localBodyName: 'Kandhampatty Village Panchayat', block: 'Salem Block', villagePanchayat: 'Kandhampatty', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 23. Sivaganga (Madurai)
    { id: 112, sno: 112, state: 'Tamil Nadu', division: 'Madurai', district: 'Sivaganga', localBody: 'Municipality', localBodyName: 'Sivaganga Municipality', block: 'Sivaganga Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Sivaganga', gcc: '-', cmwssb: '-' },
    { id: 113, sno: 113, state: 'Tamil Nadu', division: 'Madurai', district: 'Sivaganga', localBody: 'Municipality', localBodyName: 'Karaikudi Municipality', block: 'Sakkottai Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Karaikudi', gcc: '-', cmwssb: '-' },
    { id: 114, sno: 114, state: 'Tamil Nadu', division: 'Madurai', district: 'Sivaganga', localBody: 'Town Panchayat', localBodyName: 'Thiruppuvanam Town Panchayat', block: 'Thiruppuvanam Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Thiruppuvanam', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 115, sno: 115, state: 'Tamil Nadu', division: 'Madurai', district: 'Sivaganga', localBody: 'Town Panchayat', localBodyName: 'Manamadurai Town Panchayat', block: 'Manamadurai Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Manamadurai', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 116, sno: 116, state: 'Tamil Nadu', division: 'Madurai', district: 'Sivaganga', localBody: 'Village Panchayat', localBodyName: 'Payampon Village Panchayat', block: 'Sivaganga Block', villagePanchayat: 'Payampon', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 24. Tenkasi (Tirunelveli)
    { id: 117, sno: 117, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Tenkasi', localBody: 'Municipality', localBodyName: 'Tenkasi Municipality', block: 'Tenkasi Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Tenkasi', gcc: '-', cmwssb: '-' },
    { id: 118, sno: 118, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Tenkasi', localBody: 'Municipality', localBodyName: 'Sankarankovil Municipality', block: 'Sankarankovil Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Sankarankovil', gcc: '-', cmwssb: '-' },
    { id: 119, sno: 119, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Tenkasi', localBody: 'Municipality', localBodyName: 'Kadayanallur Municipality', block: 'Kadayanallur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Kadayanallur', gcc: '-', cmwssb: '-' },
    { id: 120, sno: 120, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Tenkasi', localBody: 'Town Panchayat', localBodyName: 'Courtallam Town Panchayat', block: 'Tenkasi Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Courtallam', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 121, sno: 121, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Tenkasi', localBody: 'Village Panchayat', localBodyName: 'Kasimajorpuram Village Panchayat', block: 'Shenkottai Block', villagePanchayat: 'Kasimajorpuram', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 25. Thanjavur (Thanjavur)
    { id: 122, sno: 122, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Thanjavur', localBody: 'Corporation', localBodyName: 'Thanjavur City Municipal Corporation', block: 'Thanjavur Block', villagePanchayat: '-', corporation: 'Thanjavur', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 123, sno: 123, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Thanjavur', localBody: 'Corporation', localBodyName: 'Kumbakonam City Corporation', block: 'Kumbakonam Block', villagePanchayat: '-', corporation: 'Kumbakonam', townPanchayat: '-', municipality: 'Kumbakonam', gcc: '-', cmwssb: '-' },
    { id: 124, sno: 124, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Thanjavur', localBody: 'Municipality', localBodyName: 'Pattukkottai Municipality', block: 'Pattukkottai Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Pattukkottai', gcc: '-', cmwssb: '-' },
    { id: 125, sno: 125, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Thanjavur', localBody: 'Town Panchayat', localBodyName: 'Thiruvaiyaru Town Panchayat', block: 'Thiruvaiyaru Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Thiruvaiyaru', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 126, sno: 126, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Thanjavur', localBody: 'Village Panchayat', localBodyName: 'Vallam Village Panchayat', block: 'Thanjavur Block', villagePanchayat: 'Vallam', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 26. The Nilgiris (Coimbatore)
    { id: 127, sno: 127, state: 'Tamil Nadu', division: 'Coimbatore', district: 'The Nilgiris', localBody: 'Municipality', localBodyName: 'Udhagamandalam (Ooty) Municipality', block: 'Udhagamandalam Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Ooty', gcc: '-', cmwssb: '-' },
    { id: 128, sno: 128, state: 'Tamil Nadu', division: 'Coimbatore', district: 'The Nilgiris', localBody: 'Municipality', localBodyName: 'Coonoor Municipality', block: 'Coonoor Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Coonoor', gcc: '-', cmwssb: '-' },
    { id: 129, sno: 129, state: 'Tamil Nadu', division: 'Coimbatore', district: 'The Nilgiris', localBody: 'Municipality', localBodyName: 'Gudalur Municipality', block: 'Gudalur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Gudalur', gcc: '-', cmwssb: '-' },
    { id: 130, sno: 130, state: 'Tamil Nadu', division: 'Coimbatore', district: 'The Nilgiris', localBody: 'Town Panchayat', localBodyName: 'Kotagiri Town Panchayat', block: 'Kotagiri Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Kotagiri', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 131, sno: 131, state: 'Tamil Nadu', division: 'Coimbatore', district: 'The Nilgiris', localBody: 'Village Panchayat', localBodyName: 'Ketti Village Panchayat', block: 'Coonoor Block', villagePanchayat: 'Ketti', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 27. Theni (Madurai)
    { id: 132, sno: 132, state: 'Tamil Nadu', division: 'Madurai', district: 'Theni', localBody: 'Municipality', localBodyName: 'Theni Allinagaram Municipality', block: 'Theni Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Theni', gcc: '-', cmwssb: '-' },
    { id: 133, sno: 133, state: 'Tamil Nadu', division: 'Madurai', district: 'Theni', localBody: 'Municipality', localBodyName: 'Bodinayakanur Municipality', block: 'Bodinayakanur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Bodinayakanur', gcc: '-', cmwssb: '-' },
    { id: 134, sno: 134, state: 'Tamil Nadu', division: 'Madurai', district: 'Theni', localBody: 'Municipality', localBodyName: 'Periyakulam Municipality', block: 'Periyakulam Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Periyakulam', gcc: '-', cmwssb: '-' },
    { id: 135, sno: 135, state: 'Tamil Nadu', division: 'Madurai', district: 'Theni', localBody: 'Town Panchayat', localBodyName: 'Chinnamanoor Town Panchayat', block: 'Uthamapalayam Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Chinnamanoor', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 136, sno: 136, state: 'Tamil Nadu', division: 'Madurai', district: 'Theni', localBody: 'Village Panchayat', localBodyName: 'Unjampatti Village Panchayat', block: 'Theni Block', villagePanchayat: 'Unjampatti', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 28. Thiruchirappalli (Trichy)
    { id: 137, sno: 137, state: 'Tamil Nadu', division: 'Trichy', district: 'Thiruchirappalli', localBody: 'Corporation', localBodyName: 'Tiruchirappalli City Corporation', block: 'Trichy Urban Block', villagePanchayat: '-', corporation: 'Trichy', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 138, sno: 138, state: 'Tamil Nadu', division: 'Trichy', district: 'Thiruchirappalli', localBody: 'Municipality', localBodyName: 'Manapparai Municipality', block: 'Manapparai Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Manapparai', gcc: '-', cmwssb: '-' },
    { id: 139, sno: 139, state: 'Tamil Nadu', division: 'Trichy', district: 'Thiruchirappalli', localBody: 'Municipality', localBodyName: 'Thuraiyur Municipality', block: 'Thuraiyur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Thuraiyur', gcc: '-', cmwssb: '-' },
    { id: 140, sno: 140, state: 'Tamil Nadu', division: 'Trichy', district: 'Thiruchirappalli', localBody: 'Town Panchayat', localBodyName: 'Thuvakudi Town Panchayat', block: 'Thiruverumbur Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Thuvakudi', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 141, sno: 141, state: 'Tamil Nadu', division: 'Trichy', district: 'Thiruchirappalli', localBody: 'Village Panchayat', localBodyName: 'K. Sathanur Village Panchayat', block: 'Andanallur Block', villagePanchayat: 'K. Sathanur', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 29. Thirunelveli (Tirunelveli)
    { id: 142, sno: 142, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Thirunelveli', localBody: 'Corporation', localBodyName: 'Tirunelveli City Corporation', block: 'Palayamkottai Block', villagePanchayat: '-', corporation: 'Tirunelveli', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 143, sno: 143, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Thirunelveli', localBody: 'Municipality', localBodyName: 'Ambasamudram Municipality', block: 'Ambasamudram Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Ambasamudram', gcc: '-', cmwssb: '-' },
    { id: 144, sno: 144, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Thirunelveli', localBody: 'Municipality', localBodyName: 'Vikramasingapuram Municipality', block: 'Cheranmahadevi Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Vikramasingapuram', gcc: '-', cmwssb: '-' },
    { id: 145, sno: 145, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Thirunelveli', localBody: 'Town Panchayat', localBodyName: 'Mukkudal Town Panchayat', block: 'Pappakudi Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Mukkudal', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 146, sno: 146, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Thirunelveli', localBody: 'Village Panchayat', localBodyName: 'Reddiarpatti Village Panchayat', block: 'Palayamkottai Block', villagePanchayat: 'Reddiarpatti', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 30. Thiruvallur (Chennai)
    { id: 147, sno: 147, state: 'Tamil Nadu', division: 'Chennai', district: 'Thiruvallur', localBody: 'Corporation', localBodyName: 'Avadi City Municipal Corporation', block: 'Poonamallee Block', villagePanchayat: '-', corporation: 'Avadi', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 148, sno: 148, state: 'Tamil Nadu', division: 'Chennai', district: 'Thiruvallur', localBody: 'Municipality', localBodyName: 'Tiruvallur Municipality', block: 'Tiruvallur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Tiruvallur', gcc: '-', cmwssb: '-' },
    { id: 149, sno: 149, state: 'Tamil Nadu', division: 'Chennai', district: 'Thiruvallur', localBody: 'Municipality', localBodyName: 'Poonamallee Municipality', block: 'Poonamallee Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Poonamallee', gcc: '-', cmwssb: '-' },
    { id: 150, sno: 150, state: 'Tamil Nadu', division: 'Chennai', district: 'Thiruvallur', localBody: 'Town Panchayat', localBodyName: 'Gummidipoondi Town Panchayat', block: 'Gummidipoondi Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Gummidipoondi', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 151, sno: 151, state: 'Tamil Nadu', division: 'Chennai', district: 'Thiruvallur', localBody: 'Village Panchayat', localBodyName: 'Nemam Village Panchayat', block: 'Poonamallee Block', villagePanchayat: 'Nemam', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 31. Thiruvannamalai (Villupuram)
    { id: 152, sno: 152, state: 'Tamil Nadu', division: 'Villupuram', district: 'Thiruvannamalai', localBody: 'Municipality', localBodyName: 'Tiruvannamalai Municipality', block: 'Tiruvannamalai Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Tiruvannamalai', gcc: '-', cmwssb: '-' },
    { id: 153, sno: 153, state: 'Tamil Nadu', division: 'Villupuram', district: 'Thiruvannamalai', localBody: 'Municipality', localBodyName: 'Arani Municipality', block: 'Arani Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Arani', gcc: '-', cmwssb: '-' },
    { id: 154, sno: 154, state: 'Tamil Nadu', division: 'Villupuram', district: 'Thiruvannamalai', localBody: 'Town Panchayat', localBodyName: 'Chengam Town Panchayat', block: 'Chengam Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Chengam', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 155, sno: 155, state: 'Tamil Nadu', division: 'Villupuram', district: 'Thiruvannamalai', localBody: 'Town Panchayat', localBodyName: 'Polur Town Panchayat', block: 'Polur Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Polur', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 156, sno: 156, state: 'Tamil Nadu', division: 'Villupuram', district: 'Thiruvannamalai', localBody: 'Village Panchayat', localBodyName: 'Vengikkal Village Panchayat', block: 'Tiruvannamalai Block', villagePanchayat: 'Vengikkal', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 32. Thiruvarur (Thanjavur)
    { id: 157, sno: 157, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Thiruvarur', localBody: 'Municipality', localBodyName: 'Thiruvarur Municipality', block: 'Thiruvarur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Thiruvarur', gcc: '-', cmwssb: '-' },
    { id: 158, sno: 158, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Thiruvarur', localBody: 'Municipality', localBodyName: 'Mannargudi Municipality', block: 'Mannargudi Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Mannargudi', gcc: '-', cmwssb: '-' },
    { id: 159, sno: 159, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Thiruvarur', localBody: 'Municipality', localBodyName: 'Thiruthuraipoondi Municipality', block: 'Thiruthuraipoondi Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Thiruthuraipoondi', gcc: '-', cmwssb: '-' },
    { id: 160, sno: 160, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Thiruvarur', localBody: 'Town Panchayat', localBodyName: 'Nannilam Town Panchayat', block: 'Nannilam Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Nannilam', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 161, sno: 161, state: 'Tamil Nadu', division: 'Thanjavur', district: 'Thiruvarur', localBody: 'Village Panchayat', localBodyName: 'Kattur Village Panchayat', block: 'Thiruvarur Block', villagePanchayat: 'Kattur', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 33. Thoothukudi (Tirunelveli)
    { id: 162, sno: 162, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Thoothukudi', localBody: 'Corporation', localBodyName: 'Thoothukudi City Municipal Corporation', block: 'Thoothukudi Block', villagePanchayat: '-', corporation: 'Thoothukudi', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 163, sno: 163, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Thoothukudi', localBody: 'Municipality', localBodyName: 'Kovilpatti Municipality', block: 'Kovilpatti Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Kovilpatti', gcc: '-', cmwssb: '-' },
    { id: 164, sno: 164, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Thoothukudi', localBody: 'Municipality', localBodyName: 'Kayalpattinam Municipality', block: 'Tiruchendur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Kayalpattinam', gcc: '-', cmwssb: '-' },
    { id: 165, sno: 165, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Thoothukudi', localBody: 'Town Panchayat', localBodyName: 'Tiruchendur Town Panchayat', block: 'Tiruchendur Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Tiruchendur', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 166, sno: 166, state: 'Tamil Nadu', division: 'Tirunelveli', district: 'Thoothukudi', localBody: 'Village Panchayat', localBodyName: 'Mullakadu Village Panchayat', block: 'Thoothukudi Block', villagePanchayat: 'Mullakadu', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 34. Tirupathur (Vellore)
    { id: 167, sno: 167, state: 'Tamil Nadu', division: 'Vellore', district: 'Tirupathur', localBody: 'Municipality', localBodyName: 'Tirupathur Municipality', block: 'Tirupathur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Tirupathur', gcc: '-', cmwssb: '-' },
    { id: 168, sno: 168, state: 'Tamil Nadu', division: 'Vellore', district: 'Tirupathur', localBody: 'Municipality', localBodyName: 'Vaniyambadi Municipality', block: 'Vaniyambadi Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Vaniyambadi', gcc: '-', cmwssb: '-' },
    { id: 169, sno: 169, state: 'Tamil Nadu', division: 'Vellore', district: 'Tirupathur', localBody: 'Municipality', localBodyName: 'Ambur Municipality', block: 'Madhanur Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Ambur', gcc: '-', cmwssb: '-' },
    { id: 170, sno: 170, state: 'Tamil Nadu', division: 'Vellore', district: 'Tirupathur', localBody: 'Town Panchayat', localBodyName: 'Natrampalli Town Panchayat', block: 'Natrampalli Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Natrampalli', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 171, sno: 171, state: 'Tamil Nadu', division: 'Vellore', district: 'Tirupathur', localBody: 'Village Panchayat', localBodyName: 'Kandili Village Panchayat', block: 'Kandili Block', villagePanchayat: 'Kandili', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 35. Tiruppur (Coimbatore)
    { id: 172, sno: 172, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Tiruppur', localBody: 'Corporation', localBodyName: 'Tiruppur City Municipal Corporation', block: 'Tiruppur North Block', villagePanchayat: '-', corporation: 'Tiruppur', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 173, sno: 173, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Tiruppur', localBody: 'Municipality', localBodyName: 'Udumalaipettai Municipality', block: 'Udumalaipettai Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Udumalaipettai', gcc: '-', cmwssb: '-' },
    { id: 174, sno: 174, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Tiruppur', localBody: 'Municipality', localBodyName: 'Dharapuram Municipality', block: 'Dharapuram Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Dharapuram', gcc: '-', cmwssb: '-' },
    { id: 175, sno: 175, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Tiruppur', localBody: 'Town Panchayat', localBodyName: 'Kangeyam Town Panchayat', block: 'Kangeyam Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Kangeyam', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 176, sno: 176, state: 'Tamil Nadu', division: 'Coimbatore', district: 'Tiruppur', localBody: 'Village Panchayat', localBodyName: 'Mannarai Village Panchayat', block: 'Tiruppur Block', villagePanchayat: 'Mannarai', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 36. Vellore (Vellore)
    { id: 177, sno: 177, state: 'Tamil Nadu', division: 'Vellore', district: 'Vellore', localBody: 'Corporation', localBodyName: 'Vellore City Municipal Corporation', block: 'Katpadi Block', villagePanchayat: '-', corporation: 'Vellore', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 178, sno: 178, state: 'Tamil Nadu', division: 'Vellore', district: 'Vellore', localBody: 'Municipality', localBodyName: 'Gudiyattam Municipality', block: 'Gudiyattam Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Gudiyattam', gcc: '-', cmwssb: '-' },
    { id: 179, sno: 179, state: 'Tamil Nadu', division: 'Vellore', district: 'Vellore', localBody: 'Municipality', localBodyName: 'Pernambut Municipality', block: 'Pernambut Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Pernambut', gcc: '-', cmwssb: '-' },
    { id: 180, sno: 180, state: 'Tamil Nadu', division: 'Vellore', district: 'Vellore', localBody: 'Town Panchayat', localBodyName: 'Pennathur Town Panchayat', block: 'Vellore Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Pennathur', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 181, sno: 181, state: 'Tamil Nadu', division: 'Vellore', district: 'Vellore', localBody: 'Village Panchayat', localBodyName: 'Shenbakkam Village Panchayat', block: 'Katpadi Block', villagePanchayat: 'Shenbakkam', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 37. Villupuram (Villupuram)
    { id: 182, sno: 182, state: 'Tamil Nadu', division: 'Villupuram', district: 'Villupuram', localBody: 'Municipality', localBodyName: 'Villupuram Municipality', block: 'Villupuram Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Villupuram', gcc: '-', cmwssb: '-' },
    { id: 183, sno: 183, state: 'Tamil Nadu', division: 'Villupuram', district: 'Villupuram', localBody: 'Municipality', localBodyName: 'Tindivanam Municipality', block: 'Tindivanam Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Tindivanam', gcc: '-', cmwssb: '-' },
    { id: 184, sno: 184, state: 'Tamil Nadu', division: 'Villupuram', district: 'Villupuram', localBody: 'Town Panchayat', localBodyName: 'Gingee Town Panchayat', block: 'Gingee Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Gingee', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 185, sno: 185, state: 'Tamil Nadu', division: 'Villupuram', district: 'Villupuram', localBody: 'Town Panchayat', localBodyName: 'Marakkanam Town Panchayat', block: 'Marakkanam Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Marakkanam', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 186, sno: 186, state: 'Tamil Nadu', division: 'Villupuram', district: 'Villupuram', localBody: 'Village Panchayat', localBodyName: 'Koliyanur Village Panchayat', block: 'Koliyanur Block', villagePanchayat: 'Koliyanur', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },

    // 38. Virudhunagar (Madurai)
    { id: 187, sno: 187, state: 'Tamil Nadu', division: 'Madurai', district: 'Virudhunagar', localBody: 'Corporation', localBodyName: 'Sivakasi City Corporation', block: 'Sivakasi Block', villagePanchayat: '-', corporation: 'Sivakasi', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 188, sno: 188, state: 'Tamil Nadu', division: 'Madurai', district: 'Virudhunagar', localBody: 'Municipality', localBodyName: 'Virudhunagar Municipality', block: 'Virudhunagar Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Virudhunagar', gcc: '-', cmwssb: '-' },
    { id: 189, sno: 189, state: 'Tamil Nadu', division: 'Madurai', district: 'Virudhunagar', localBody: 'Municipality', localBodyName: 'Rajapalayam Municipality', block: 'Rajapalayam Block', villagePanchayat: '-', corporation: '-', townPanchayat: '-', municipality: 'Rajapalayam', gcc: '-', cmwssb: '-' },
    { id: 190, sno: 190, state: 'Tamil Nadu', division: 'Madurai', district: 'Virudhunagar', localBody: 'Town Panchayat', localBodyName: 'Kariapatti Town Panchayat', block: 'Kariapatti Block', villagePanchayat: '-', corporation: '-', townPanchayat: 'Kariapatti', municipality: '-', gcc: '-', cmwssb: '-' },
    { id: 191, sno: 191, state: 'Tamil Nadu', division: 'Madurai', district: 'Virudhunagar', localBody: 'Village Panchayat', localBodyName: 'Rosalpatti Village Panchayat', block: 'Virudhunagar Block', villagePanchayat: 'Rosalpatti', corporation: '-', townPanchayat: '-', municipality: '-', gcc: '-', cmwssb: '-' }
  ];

  constructor(
    private http: HttpClient,
    private msg: MessageService,
    private confirm: ConfirmationService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRoles();
    this.loadProjects();
    this.loadMappings();
    this.loadUsersList();
    this.loadRecords();

    this.route.queryParams.subscribe(params => {
      const tab = params['tab'];
      if (tab === 'roles') this.activeTabIndex = 0;
      else if (tab === 'projects') this.activeTabIndex = 1;
      else if (tab === 'mappings') this.activeTabIndex = 2;
      else if (tab === 'privileges') this.activeTabIndex = 3;
      else if (tab === 'localbody') this.activeTabIndex = 4;
      this.cdr.markForCheck();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. ROLE MANAGEMENT LOGIC
  // ══════════════════════════════════════════════════════════════════════════

  loadRoles(): void {
    this.roleLoading = true;
    const fallback = () => {
      this.roles = this.getDefaultRoles();
      this.applyRoleFilter();
      this.roleLoading = false;
      this.cdr.markForCheck();
    };

    if (!this.api) { fallback(); return; }
    this.http.get<AppRole[]>(`${this.api}/roles`).pipe(catchError(() => of(null))).subscribe(res => {
      if (res && res.length > 0) {
        this.roles = res;
        this.applyRoleFilter();
        this.roleLoading = false;
        this.cdr.markForCheck();
      } else {
        fallback();
      }
    });
  }

  applyRoleFilter(): void {
    const q = this.roleSearch.trim().toLowerCase();
    this.filteredRoles = this.roles.filter(r =>
      !q || r.roleCode.toLowerCase().includes(q) || r.roleName.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
    );
    this.cdr.markForCheck();
  }

  openNewRole(): void {
    this.isRoleEditing = false;
    this.currentRole = { roleCode: '', roleName: '', description: '', scope: 'all', isSystem: false, isActive: true, assignedProjects: [] };
    this.roleModalVisible = true;
  }

  openEditRole(role: AppRole): void {
    this.isRoleEditing = true;
    this.currentRole = { ...role, assignedProjects: [...(role.assignedProjects || [])] };
    this.roleModalVisible = true;
  }

  saveRole(): void {
    const r = this.currentRole;
    if (!r.roleCode || !r.roleName) {
      this.msg.add({ severity: 'warn', summary: 'Validation Error', detail: 'Role Code and Role Name are mandatory.' });
      return;
    }

    const cleanCode = r.roleCode.trim().toLowerCase().replace(/\s+/g, '_');
    if (!/^[a-z0-9_]{2,30}$/.test(cleanCode)) {
      this.msg.add({ severity: 'warn', summary: 'Validation Error', detail: 'Role Code must be 2–30 characters containing only letters, numbers, and underscores.' });
      return;
    }

    const cleanName = r.roleName.trim().replace(/\s+/g, ' ');
    if (cleanName.length < 3) {
      this.msg.add({ severity: 'warn', summary: 'Validation Error', detail: 'Role Name must be at least 3 characters.' });
      return;
    }

    const cleanDesc = (r.description || '').trim().replace(/\s+/g, ' ');
    if (cleanDesc && cleanDesc.length > 250) {
      this.msg.add({ severity: 'warn', summary: 'Validation Error', detail: 'Description cannot exceed 250 characters.' });
      return;
    }

    const rolePayload = {
      roleCode: cleanCode,
      roleName: cleanName,
      description: cleanDesc,
      scope: r.scope || 'all',
      isActive: r.isActive !== false,
      projectCodes: r.assignedProjects || []
    };

    const done = (msg: string) => {
      this.msg.add({ severity: 'success', summary: this.isRoleEditing ? 'Role Updated' : 'Role Created', detail: msg });
      this.roleModalVisible = false;
      this.loadRoles();
      this.loadMappings();
    };

    if (!this.api) {
      if (this.isRoleEditing) {
        const idx = this.roles.findIndex(x => x.roleCode === r.roleCode || x.roleId === r.roleId);
        if (idx > -1) this.roles[idx] = { ...this.roles[idx], ...rolePayload };
      } else {
        this.roles.push({ ...rolePayload, roleId: this.roles.length + 1, isSystem: false, userCount: 0 });
      }
      done(`Role '${r.roleName}' saved successfully.`);
      return;
    }

    const req = this.isRoleEditing
      ? this.http.put(`${this.api}/roles/${r.roleId || 0}`, rolePayload)
      : this.http.post(`${this.api}/roles`, rolePayload);

    req.pipe(catchError((err) => {
      this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to save role.' });
      return of(null);
    })).subscribe(res => {
      if (res) done(`Role '${r.roleName}' saved successfully.`);
    });
  }

  confirmDeleteRole(role: AppRole): void {
    if (role.isSystem) {
      this.msg.add({ severity: 'error', summary: 'Restricted', detail: 'Core system roles cannot be deleted.' });
      return;
    }
    this.confirm.confirm({
      message: `Are you sure you want to delete role '${role.roleName}' (${role.roleCode})? All associated mappings will be cleared.`,
      header: 'Delete Role Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete Role',
      rejectLabel: 'Cancel',
      accept: () => {
        if (!this.api) {
          this.roles = this.roles.filter(r => r.roleCode !== role.roleCode);
          this.applyRoleFilter();
          this.msg.add({ severity: 'success', summary: 'Deleted', detail: `Role '${role.roleName}' removed.` });
          return;
        }
        this.http.delete(`${this.api}/roles/${role.roleId}`).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Deleted', detail: `Role '${role.roleName}' removed.` });
            this.loadRoles();
            this.loadMappings();
          },
          error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to delete role.' })
        });
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. PROJECT MANAGEMENT LOGIC (Engineering, Welfare, TNCWWN, etc.)
  // ══════════════════════════════════════════════════════════════════════════

  loadProjects(): void {
    this.projectLoading = true;
    const fallback = () => {
      const stored = localStorage.getItem('udp_projects');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.projects = parsed;
            this.applyProjectFilter();
            this.projectLoading = false;
            this.cdr.markForCheck();
            return;
          }
        } catch {}
      }
      this.projects = this.getDefaultProjects();
      localStorage.setItem('udp_projects', JSON.stringify(this.projects));
      this.applyProjectFilter();
      this.projectLoading = false;
      this.cdr.markForCheck();
    };

    if (!this.api) { fallback(); return; }
    this.http.get<AppProject[]>(`${this.api}/projects`).pipe(catchError(() => of(null))).subscribe(res => {
      if (res && res.length > 0) {
        this.projects = res;
        localStorage.setItem('udp_projects', JSON.stringify(this.projects));
        this.applyProjectFilter();
        this.projectLoading = false;
        this.cdr.markForCheck();
      } else {
        fallback();
      }
    });
  }

  applyProjectFilter(): void {
    const q = this.projectSearch.trim().toLowerCase();
    const cat = this.projectCategoryFilter;
    this.filteredProjects = this.projects.filter(p => {
      const matchQ = !q || p.projectCode.toLowerCase().includes(q) || p.projectName.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      const matchCat = cat === 'All' || p.category.toLowerCase() === cat.toLowerCase();
      return matchQ && matchCat;
    });
    this.cdr.markForCheck();
  }

  isCoreProject(p: AppProject): boolean {
    if (!p) return false;
    const code = (p.projectCode || '').trim().toUpperCase();
    const name = (p.projectName || '').trim().toLowerCase();
    return (
      code === 'ENG' ||
      code === 'WELFARE' ||
      code === 'TNCWW' ||
      code === 'TNCWWN' ||
      code === 'TNCWWB' ||
      name === 'engineering' ||
      name === 'welfare' ||
      name === 'tncwwn' ||
      name === 'tncwwb' ||
      name === 'tncww'
    );
  }

  openNewProject(): void {
    this.isProjectEditing = false;
    this.currentProject = { projectCode: '', projectName: '', category: 'Engineering', description: '', apiEndpoint: '', icon: 'pi-wrench', status: 'Active', isActive: true };
    this.projectModalVisible = true;
  }

  openEditProject(prj: AppProject): void {
    this.isProjectEditing = true;
    this.currentProject = { ...prj };
    this.projectModalVisible = true;
  }

  saveProject(): void {
    const p = this.currentProject;
    if (!p.projectCode || !p.projectName) {
      this.msg.add({ severity: 'warn', summary: 'Validation Error', detail: 'Project Code and Project Name are mandatory.' });
      return;
    }

    const payload = {
      projectCode: p.projectCode.trim().toUpperCase().replace(/\s+/g, '_'),
      projectName: p.projectName.trim(),
      category: p.category,
      description: p.description,
      apiEndpoint: p.apiEndpoint,
      icon: p.icon || 'pi-folder',
      status: p.status,
      isActive: p.isActive
    };

    const done = (msg: string) => {
      localStorage.setItem('udp_projects', JSON.stringify(this.projects));
      window.dispatchEvent(new Event('projects_updated'));
      this.msg.add({ severity: 'success', summary: this.isProjectEditing ? 'Project Updated' : 'Project Created', detail: msg });
      this.projectModalVisible = false;
      this.loadProjects();
      this.loadMappings();
    };

    if (!this.api) {
      if (this.isProjectEditing) {
        const idx = this.projects.findIndex(x => x.projectCode === p.projectCode || x.projectId === p.projectId);
        if (idx > -1) this.projects[idx] = { ...this.projects[idx], ...payload };
      } else {
        this.projects.push({ ...payload, projectId: this.projects.length + 1, activeUserCount: 0, activeRoleCount: 0 });
      }
      done(`Project '${p.projectName}' saved.`);
      return;
    }

    const req = this.isProjectEditing
      ? this.http.put(`${this.api}/projects/${p.projectId || 0}`, payload)
      : this.http.post(`${this.api}/projects`, payload);

    req.pipe(catchError(err => {
      this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to save project.' });
      return of(null);
    })).subscribe(res => {
      if (res) done(`Project '${p.projectName}' saved successfully.`);
    });
  }

  confirmDeleteProject(prj: AppProject): void {
    this.confirm.confirm({
      message: `Are you sure you want to delete project '${prj.projectName}' (${prj.projectCode})? All mapped permissions will be revoked.`,
      header: 'Delete Project Confirmation',
      icon: 'pi-exclamation-triangle',
      acceptLabel: 'Delete Project',
      rejectLabel: 'Cancel',
      accept: () => {
        if (!this.api) {
          this.projects = this.projects.filter(p => p.projectCode !== prj.projectCode);
          localStorage.setItem('udp_projects', JSON.stringify(this.projects));
          window.dispatchEvent(new Event('projects_updated'));
          this.applyProjectFilter();
          this.msg.add({ severity: 'success', summary: 'Deleted', detail: `Project '${prj.projectName}' removed.` });
          return;
        }
        this.http.delete(`${this.api}/projects/${prj.projectId}`).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Deleted', detail: `Project '${prj.projectName}' removed.` });
            this.loadProjects();
            this.loadMappings();
          },
          error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to delete project.' })
        });
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. PROJECT MAPPING LOGIC (User / Role to Project)
  // ══════════════════════════════════════════════════════════════════════════

  loadMappings(): void {
    this.mappingLoading = true;
    const fallback = () => {
      this.mappings = this.getDefaultMappings();
      this.applyMappingFilter();
      this.mappingLoading = false;
      this.cdr.markForCheck();
    };

    if (!this.api) { fallback(); return; }
    this.http.get<ProjectMapping[]>(`${this.api}/project-mappings`).pipe(catchError(() => of(null))).subscribe(res => {
      if (res && res.length > 0) {
        this.mappings = res;
        this.applyMappingFilter();
        this.mappingLoading = false;
        this.cdr.markForCheck();
      } else {
        fallback();
      }
    });
  }

  applyMappingFilter(): void {
    const q = this.mappingSearch.trim().toLowerCase();
    const type = this.mappingTypeFilter;
    const prj = this.mappingProjectFilter;

    this.filteredMappings = this.mappings.filter(m => {
      const matchQ = !q || m.entityName.toLowerCase().includes(q) || m.entityCode.toLowerCase().includes(q) || m.projectName.toLowerCase().includes(q) || m.projectCode.toLowerCase().includes(q);
      const matchType = type === 'ALL' || m.mappingType === type;
      const matchPrj = prj === 'ALL' || m.projectCode === prj;
      return matchQ && matchType && matchPrj;
    });
    this.cdr.markForCheck();
  }

  openNewMapping(): void {
    this.isMappingEditing = false;
    this.currentMapping = {
      mappingType: 'ROLE',
      entityCode: this.roles[0]?.roleCode || 'admin',
      entityName: this.roles[0]?.roleName || 'Application Admin',
      projectCode: this.projects[0]?.projectCode || 'ENG',
      projectName: this.projects[0]?.projectName || 'Engineering',
      canView: true,
      canCreate: false,
      canEdit: false,
      canUpdate: false,
      canDelete: false,
      status: 'Active'
    };
    this.mappingModalVisible = true;
  }

  openEditMapping(m: ProjectMapping): void {
    this.isMappingEditing = true;
    this.currentMapping = { ...m };
    this.mappingModalVisible = true;
  }

  onEntitySelectedInMapping(entityCode: string): void {
    if (this.currentMapping.mappingType === 'ROLE') {
      const r = this.roles.find(x => x.roleCode === entityCode);
      if (r) this.currentMapping.entityName = r.roleName;
    } else {
      const u = this.auth.getAllUsers().find(x => x.email === entityCode);
      if (u) this.currentMapping.entityName = u.name;
    }
  }

  onProjectSelectedInMapping(projectCode: string): void {
    const p = this.projects.find(x => x.projectCode === projectCode);
    if (p) this.currentMapping.projectName = p.projectName;
  }

  saveMapping(): void {
    const m = this.currentMapping;
    if (!m.entityCode || !m.projectCode) {
      this.msg.add({ severity: 'warn', summary: 'Validation Error', detail: 'Entity and Project selection are required.' });
      return;
    }

    if (m.status === 'Active' && !m.canView && !m.canCreate && !m.canEdit && !m.canUpdate && !m.canDelete) {
      this.msg.add({ severity: 'warn', summary: 'Validation Error', detail: 'Active mappings must have at least View permission granted.' });
      return;
    }

    const isDup = this.mappings.some(x =>
      x.mappingType === m.mappingType &&
      x.entityCode === m.entityCode &&
      x.projectCode === m.projectCode &&
      (!this.isMappingEditing || x.mappingId !== m.mappingId)
    );

    if (isDup && !this.isMappingEditing) {
      this.msg.add({ severity: 'error', summary: 'Duplicate Mapping', detail: `Mapping for ${m.entityName} -> ${m.projectCode} already exists.` });
      return;
    }

    const payload = {
      mappingType: m.mappingType,
      entityCode: m.entityCode,
      entityName: m.entityName || m.entityCode,
      projectCode: m.projectCode,
      projectName: m.projectName || m.projectCode,
      canView: m.canView,
      canCreate: m.canCreate,
      canEdit: m.canEdit,
      canUpdate: m.canUpdate,
      canDelete: m.canDelete,
      status: m.status,
      assignedBy: this.auth.currentUser?.name || 'System Admin'
    };

    const done = (msg: string) => {
      this.msg.add({ severity: 'success', summary: this.isMappingEditing ? 'Mapping Updated' : 'Mapping Created', detail: msg });
      this.mappingModalVisible = false;
      this.loadMappings();
    };

    if (!this.api) {
      if (this.isMappingEditing) {
        const idx = this.mappings.findIndex(x => x.mappingId === m.mappingId);
        if (idx > -1) this.mappings[idx] = { ...this.mappings[idx], ...payload };
      } else {
        this.mappings.push({ ...payload, mappingId: this.mappings.length + 1 });
      }
      done(`Project mapped successfully.`);
      return;
    }

    const req = this.isMappingEditing
      ? this.http.put(`${this.api}/project-mappings/${m.mappingId || 0}`, payload)
      : this.http.post(`${this.api}/project-mappings`, payload);

    req.pipe(catchError(err => {
      this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to save mapping.' });
      return of(null);
    })).subscribe(res => {
      if (res) done(`Project mapped successfully.`);
    });
  }

  confirmDeleteMapping(m: ProjectMapping): void {
    this.confirm.confirm({
      message: `Revoke project mapping for ${m.entityName} on project '${m.projectName}'?`,
      header: 'Revoke Mapping',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Revoke',
      rejectLabel: 'Cancel',
      accept: () => {
        if (!this.api) {
          this.mappings = this.mappings.filter(x => x.mappingId !== m.mappingId);
          this.applyMappingFilter();
          this.msg.add({ severity: 'success', summary: 'Revoked', detail: `Mapping removed.` });
          return;
        }
        this.http.delete(`${this.api}/project-mappings/${m.mappingId}`).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Revoked', detail: `Mapping removed.` });
            this.loadMappings();
          },
          error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to delete mapping.' })
        });
      }
    });
  }

  // ── Seed Helpers ──────────────────────────────────────────────────────────
  getDefaultRoles(): AppRole[] {
    return [
      { roleId: 1, roleCode: 'admin', roleName: 'Application Admin', description: 'Full administrative access to all configuration and security settings', scope: 'all', isSystem: true, isActive: true, userCount: 1, assignedProjects: ['ENG', 'WELFARE', 'TNCWWB', 'TIPS', 'TIME', 'THMS', 'TAMS', 'SCHEME', 'TELP', 'TOD', 'ONEPORTAL', 'PATROL360'] },
      { roleId: 2, roleCode: 'md', roleName: 'Managing Director', description: 'Strategic oversight of corporation-wide projects and KPIs', scope: 'all', isSystem: true, isActive: true, userCount: 1, assignedProjects: ['ENG', 'WELFARE', 'TNCWWB', 'TIPS', 'TIME', 'THMS', 'TAMS', 'SCHEME', 'TELP', 'TOD', 'ONEPORTAL', 'PATROL360'] },
      { roleId: 3, roleCode: 'secretary', roleName: 'Secretary', description: 'Government oversight and high-level performance reporting', scope: 'all', isSystem: true, isActive: true, userCount: 1, assignedProjects: ['ENG', 'WELFARE', 'TNCWWB', 'TIPS', 'TIME', 'THMS', 'TAMS', 'SCHEME', 'TELP', 'TOD', 'ONEPORTAL', 'PATROL360'] },
      { roleId: 4, roleCode: 'ce', roleName: 'Chief Engineer', description: 'Statewide engineering, tender, housing, and surveillance monitoring', scope: 'all', isSystem: true, isActive: true, userCount: 1, assignedProjects: ['ENG', 'TIPS', 'TIME', 'PATROL360', 'THMS'] },
      { roleId: 5, roleCode: 'gm', roleName: 'General Manager', description: 'Corporate management across welfare schemes, loans, and training', scope: 'all', isSystem: true, isActive: true, userCount: 1, assignedProjects: ['WELFARE', 'SCHEME', 'TELP', 'TAMS', 'TOD'] },
      { roleId: 6, roleCode: 'ee', roleName: 'Executive Engineer', description: 'Division-level engineering, tender execution, and progress tracking', scope: 'division', isSystem: true, isActive: true, userCount: 9, assignedProjects: ['ENG', 'TIPS', 'TIME', 'PATROL360', 'THMS'] },
      { roleId: 7, roleCode: 'dm', roleName: 'District Manager', description: 'District-level welfare, schemes, loans, and field operational execution', scope: 'district', isSystem: true, isActive: true, userCount: 37, assignedProjects: ['WELFARE', 'SCHEME', 'TELP', 'TAMS', 'TOD', 'TNCWWB'] },
      { roleId: 8, roleCode: 'eng_lead', roleName: 'Engineering Project Lead', description: 'Dedicated lead for engineering and infrastructure projects', scope: 'all', isSystem: false, isActive: true, userCount: 2, assignedProjects: ['ENG', 'TIPS', 'TIME', 'PATROL360', 'THMS'] },
      { roleId: 9, roleCode: 'welfare_officer', roleName: 'Welfare Officer', description: 'Coordinates TAHDCO welfare schemes and loan distributions', scope: 'district', isSystem: false, isActive: true, userCount: 4, assignedProjects: ['WELFARE', 'SCHEME', 'TELP'] },
      { roleId: 10, roleCode: 'tncwwn_coord', roleName: 'TNCWWB Coordinator', description: 'Oversees Construction Workers Welfare Board integrations', scope: 'all', isSystem: false, isActive: true, userCount: 2, assignedProjects: ['TNCWWB', 'ONEPORTAL'] }
    ];
  }

  getDefaultProjects(): AppProject[] {
    return [
      { projectId: 1, projectCode: 'ENG', projectName: 'Engineering', category: 'Engineering', description: 'Unified Engineering project umbrella for construction, tenders and infrastructure', apiEndpoint: 'https://time.tahdco.com/api/Report/OneDashboard_Work_Get', icon: 'pi-wrench', status: 'Active', isActive: true, activeUserCount: 12, activeRoleCount: 4 },
      { projectId: 2, projectCode: 'WELFARE', projectName: 'Welfare', category: 'Welfare', description: 'Unified Welfare project umbrella for schemes, subsidies and community upliftment', apiEndpoint: 'https://scst.pixous.info/Report/GetSchemeSummary', icon: 'pi-heart', status: 'Active', isActive: true, activeUserCount: 42, activeRoleCount: 5 },
      { projectId: 3, projectCode: 'TNCWWB', projectName: 'TNCWWB', category: 'Welfare Board', description: 'Tamil Nadu Construction Workers Welfare Board integrated tracking', apiEndpoint: 'https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General', icon: 'pi-id-card', status: 'Active', isActive: true, activeUserCount: 39, activeRoleCount: 4 },
      { projectId: 4, projectCode: 'TIPS', projectName: 'TIPS Tender System', category: 'Engineering', description: 'Tamil Nadu Infrastructure Procurement & Tender Management System', apiEndpoint: 'https://time.tahdco.com/api/Dashboard/Get_Mbook_Tender_Status', icon: 'pi-file-edit', status: 'Active', isActive: true, activeUserCount: 12, activeRoleCount: 4 },
      { projectId: 5, projectCode: 'TIME', projectName: 'TIME Work Progress', category: 'Engineering', description: 'TAHDCO Infrastructure Monitoring & Measurement Book Execution', apiEndpoint: 'https://time.tahdco.com/api/Report/OneDashboard_Work_Get', icon: 'pi-clock', status: 'Active', isActive: true, activeUserCount: 12, activeRoleCount: 4 },
      { projectId: 6, projectCode: 'PATROL360', projectName: 'Patrol 360 Surveillance', category: 'Engineering', description: 'Real-time CCTV & site drone patrol live streaming monitoring', apiEndpoint: 'https://time.tahdco.com/api/Report/OneDashboard_Work_Get', icon: 'pi-video', status: 'Active', isActive: true, activeUserCount: 12, activeRoleCount: 4 },
      { projectId: 7, projectCode: 'THMS', projectName: 'THMS Housing System', category: 'Engineering', description: 'TAHDCO Housing Management System for beneficiary housing phases', apiEndpoint: 'https://thmsqa.pixoustech.in/App/api/onedashboard/count', icon: 'pi-building', status: 'Active', isActive: true, activeUserCount: 12, activeRoleCount: 4 },
      { projectId: 8, projectCode: 'TAMS', projectName: 'TAMS Skill & Attendance', category: 'Welfare', description: 'TAHDCO Attendance & Vocational Training Management System', apiEndpoint: 'https://tamsqa.pixoustech.in/App/api/attendance/report-details', icon: 'pi-graduation-cap', status: 'Active', isActive: true, activeUserCount: 40, activeRoleCount: 4 },
      { projectId: 9, projectCode: 'SCHEME', projectName: 'TAHDCO Special Schemes', category: 'Welfare', description: 'SC/ST Special Central Assistance & State development schemes', apiEndpoint: 'https://scst.pixous.info/Report/GetSchemeSummary', icon: 'pi-wallet', status: 'Active', isActive: true, activeUserCount: 40, activeRoleCount: 4 },
      { projectId: 10, projectCode: 'TELP', projectName: 'TELP Financial Loans', category: 'Welfare', description: 'TAHDCO Economic & Livelihood Promotion Loan Portal', apiEndpoint: 'https://qatelp.pixous.info/api/Report/DistrictWise_ApplicationSummary', icon: 'pi-book', status: 'Active', isActive: true, activeUserCount: 40, activeRoleCount: 4 },
      { projectId: 11, projectCode: 'TOD', projectName: 'TOD Task & Diary System', category: 'Operations', description: 'TAHDCO Officer Diary & Field Task Inspection Module', apiEndpoint: 'https://tod.tahdco.app/api/Dashboard/UserTaskStatusSummaryList', icon: 'pi-calendar', status: 'Active', isActive: true, activeUserCount: 40, activeRoleCount: 4 },
      { projectId: 12, projectCode: 'ONEPORTAL', projectName: 'One Portal Aggregator', category: 'Unified Dashboard', description: 'Central Multi-Module Aggregator & Reporting Engine', apiEndpoint: 'https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General', icon: 'pi-th-large', status: 'Active', isActive: true, activeUserCount: 45, activeRoleCount: 5 }
    ];
  }

  getDefaultMappings(): ProjectMapping[] {
    return [
      { mappingId: 1, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'ENG', projectName: 'Engineering', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },
      { mappingId: 2, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'WELFARE', projectName: 'Welfare', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },
      { mappingId: 3, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'TNCWWB', projectName: 'TNCWWB', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },
      { mappingId: 4, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'TIPS', projectName: 'TIPS Tender System', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },
      { mappingId: 5, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'TIME', projectName: 'TIME Work Progress', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },
      { mappingId: 6, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'PATROL360', projectName: 'Patrol 360 Surveillance', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },
      { mappingId: 7, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'THMS', projectName: 'THMS Housing System', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },
      { mappingId: 8, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'TAMS', projectName: 'TAMS Skill & Attendance', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },
      { mappingId: 9, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'SCHEME', projectName: 'TAHDCO Special Schemes', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },
      { mappingId: 10, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'TELP', projectName: 'TELP Financial Loans', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },
      { mappingId: 11, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'TOD', projectName: 'TOD Task & Diary System', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },
      { mappingId: 12, mappingType: 'ROLE', entityCode: 'admin', entityName: 'Application Admin', projectCode: 'ONEPORTAL', projectName: 'One Portal Aggregator', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: true, status: 'Active' },

      { mappingId: 13, mappingType: 'ROLE', entityCode: 'ce', entityName: 'Chief Engineer', projectCode: 'ENG', projectName: 'Engineering', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' },
      { mappingId: 14, mappingType: 'ROLE', entityCode: 'ce', entityName: 'Chief Engineer', projectCode: 'TIPS', projectName: 'TIPS Tender System', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' },
      { mappingId: 15, mappingType: 'ROLE', entityCode: 'ce', entityName: 'Chief Engineer', projectCode: 'TIME', projectName: 'TIME Work Progress', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' },
      { mappingId: 16, mappingType: 'ROLE', entityCode: 'ce', entityName: 'Chief Engineer', projectCode: 'PATROL360', projectName: 'Patrol 360 Surveillance', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' },
      { mappingId: 17, mappingType: 'ROLE', entityCode: 'ce', entityName: 'Chief Engineer', projectCode: 'THMS', projectName: 'THMS Housing System', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' },

      { mappingId: 18, mappingType: 'ROLE', entityCode: 'gm', entityName: 'General Manager', projectCode: 'WELFARE', projectName: 'Welfare', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' },
      { mappingId: 19, mappingType: 'ROLE', entityCode: 'gm', entityName: 'General Manager', projectCode: 'SCHEME', projectName: 'TAHDCO Special Schemes', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' },
      { mappingId: 20, mappingType: 'ROLE', entityCode: 'gm', entityName: 'General Manager', projectCode: 'TELP', projectName: 'TELP Financial Loans', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' },
      { mappingId: 21, mappingType: 'ROLE', entityCode: 'gm', entityName: 'General Manager', projectCode: 'TAMS', projectName: 'TAMS Skill & Attendance', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' },
      { mappingId: 22, mappingType: 'ROLE', entityCode: 'gm', entityName: 'General Manager', projectCode: 'TOD', projectName: 'TOD Task & Diary System', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' },

      { mappingId: 23, mappingType: 'ROLE', entityCode: 'tncwwn_coord', entityName: 'TNCWWB Coordinator', projectCode: 'TNCWWB', projectName: 'TNCWWB', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' },
      { mappingId: 24, mappingType: 'ROLE', entityCode: 'tncwwn_coord', entityName: 'TNCWWB Coordinator', projectCode: 'ONEPORTAL', projectName: 'One Portal Aggregator', canView: true, canCreate: true, canEdit: true, canUpdate: true, canDelete: false, status: 'Active' }
    ];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. USER PRIVILEGES FUNCTION & MATRIX LOGIC
  // ══════════════════════════════════════════════════════════════════════════

  loadUsersList(): void {
    this.userPrivilegeLoading = true;
    const usersApi = environment.apiUrl ? `${environment.apiUrl}/api/v1/users` : '';
    const fallback = () => {
      this.usersList = this.auth.getAllUsers();
      this.applyUserFilter();
      this.userPrivilegeLoading = false;
      this.cdr.markForCheck();
    };

    if (!usersApi) { fallback(); return; }
    this.http.get<User[]>(usersApi).pipe(catchError(() => of(null))).subscribe(res => {
      if (res && res.length > 0) {
        this.usersList = res;
        this.applyUserFilter();
        this.userPrivilegeLoading = false;
        this.cdr.markForCheck();
      } else {
        fallback();
      }
    });
  }

  applyUserFilter(): void {
    const q = this.userSearch.trim().toLowerCase();
    const rf = this.userRoleFilter;
    this.filteredUsersList = this.usersList.filter(u => {
      const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.districtName || '').toLowerCase().includes(q);
      const matchR = !rf || u.role === rf;
      return matchQ && matchR;
    });
    this.cdr.markForCheck();
  }

  getUserPrivilege(user: User, project: string, action: keyof ProjectPrivilege): boolean {
    if (!user.privileges || !user.privileges[project]) return false;
    return !!user.privileges[project][action];
  }

  toggleUserPrivilege(user: User, project: string, action: keyof ProjectPrivilege): void {
    if (!user.privileges) user.privileges = {};
    if (!user.privileges[project]) {
      user.privileges[project] = { view: false, create: false, edit: false, update: false, delete: false };
    }
    user.privileges[project][action] = !user.privileges[project][action];
    this.saveUserPrivileges(user);
  }

  saveUserPrivileges(user: User): void {
    const usersApi = environment.apiUrl ? `${environment.apiUrl}/api/v1/users` : '';
    if (!usersApi) {
      this.msg.add({ severity: 'success', summary: 'Privileges Updated', detail: `Privileges for ${user.name} saved.` });
      this.cdr.markForCheck();
      return;
    }

    const payload = {
      name: user.name,
      email: user.email,
      role: user.role,
      scope: user.scope,
      districtId: user.districtId,
      divisionId: user.divisionId,
      appAccess: user.appAccess,
      privileges: user.privileges,
      isActive: user.isActive
    };

    this.http.put(`${usersApi}/${user.id}`, payload).pipe(catchError(err => {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to update privileges.' });
      return of(null);
    })).subscribe(res => {
      if (res) {
        this.msg.add({ severity: 'success', summary: 'Privileges Saved', detail: `Privileges for ${user.name} updated.` });
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. LOCAL BODY CONFIGURATION LOGIC
  // ══════════════════════════════════════════════════════════════════════════

  loadRecords(): void {
    this.loading = true;
    this.cdr.markForCheck();

    // Check LocalStorage cache first
    const cached = localStorage.getItem(this.STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.records = parsed;
          this.applyFilters();
        }
      } catch (e) {}
    }

    if (this.api) {
      const url = `${this.api}/records?search=${encodeURIComponent(this.searchTerm)}&district=${encodeURIComponent(this.selectedDistrict)}&division=${encodeURIComponent(this.selectedDivision)}`;
      this.http.get<LocalBodyMapping[]>(url).pipe(
        catchError(() => of(null))
      ).subscribe(res => {
        if (res && res.length > 0) {
          this.records = res;
          this.saveToStorage(res);
        } else if (this.records.length === 0) {
          this.records = [...this.defaultSeed];
          this.saveToStorage(this.records);
        }
        this.applyFilters();
        this.loading = false;
        this.cdr.markForCheck();
      });
    } else {
      if (this.records.length === 0) {
        this.records = [...this.defaultSeed];
        this.saveToStorage(this.records);
      }
      this.applyFilters();
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  applyFilters(): void {
    let list = [...this.records];

    if (this.selectedDivision) {
      list = list.filter(r => (r.division || '').toLowerCase() === this.selectedDivision.toLowerCase());
    }

    if (this.selectedDistrict) {
      list = list.filter(r => (r.district || '').toLowerCase() === this.selectedDistrict.toLowerCase());
    }

    if (this.selectedType) {
      list = list.filter(r => (r.localBody || '').toLowerCase() === this.selectedType.toLowerCase());
    }

    if (this.searchTerm.trim()) {
      const q = this.searchTerm.trim().toLowerCase();
      list = list.filter(r => 
        (r.state || '').toLowerCase().includes(q) ||
        (r.division || '').toLowerCase().includes(q) ||
        (r.district || '').toLowerCase().includes(q) ||
        (r.localBody || '').toLowerCase().includes(q) ||
        (r.localBodyName || '').toLowerCase().includes(q) ||
        (r.block || '').toLowerCase().includes(q) ||
        (r.villagePanchayat || '').toLowerCase().includes(q) ||
        (r.municipality || '').toLowerCase().includes(q) ||
        (r.corporation || '').toLowerCase().includes(q)
      );
    }

    this.filteredRecords = list;
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    this.first = 0;
    this.applyFilters();
  }

  openNewModal(): void {
    this.isEditing = false;
    this.currentRecord = {
      sno: this.records.length + 1,
      state: 'Tamil Nadu',
      division: 'Chennai',
      district: 'Chennai',
      localBody: 'Corporation',
      localBodyName: '',
      block: '',
      villagePanchayat: '-',
      corporation: '-',
      townPanchayat: '-',
      municipality: '-',
      gcc: '-',
      cmwssb: '-'
    };
    this.displayModal = true;
  }

  onDistrictSelectedInModal(district: string): void {
    if (!district) return;
    const divisionMap: { [d: string]: string } = {
      'Ariyalur': 'Trichy', 'Chengalpattu': 'Chennai', 'Chennai': 'Chennai',
      'Coimbatore': 'Coimbatore', 'Cuddalore': 'Villupuram', 'Dharmapuri': 'Salem',
      'Dindigul': 'Madurai', 'Erode': 'Coimbatore', 'Kallakurichi': 'Villupuram',
      'Kancheepuram': 'Chennai', 'Kanniyakumari': 'Tirunelveli', 'Karur': 'Trichy',
      'Krishnagiri': 'Salem', 'Madurai': 'Madurai', 'Mayiladuthurai': 'Thanjavur',
      'Nagapattinam': 'Thanjavur', 'Namakkal': 'Salem', 'Perambalur': 'Trichy',
      'Pudukkottai': 'Trichy', 'Ramanathapuram': 'Madurai', 'Ranipet': 'Vellore',
      'Salem': 'Salem', 'Sivaganga': 'Madurai', 'Tenkasi': 'Tirunelveli',
      'Thanjavur': 'Thanjavur', 'The Nilgiris': 'Coimbatore', 'Theni': 'Madurai',
      'Thiruchirappalli': 'Trichy', 'Thirunelveli': 'Tirunelveli', 'Thiruvallur': 'Chennai',
      'Thiruvannamalai': 'Villupuram', 'Thiruvarur': 'Thanjavur', 'Thoothukudi': 'Tirunelveli',
      'Tirupathur': 'Vellore', 'Tiruppur': 'Coimbatore', 'Vellore': 'Vellore',
      'Villupuram': 'Villupuram', 'Virudhunagar': 'Madurai'
    };
    if (divisionMap[district]) {
      this.currentRecord.division = divisionMap[district];
      this.cdr.markForCheck();
    }
  }

  openEditModal(record: LocalBodyMapping): void {
    this.isEditing = true;
    this.currentRecord = { ...record };
    this.displayModal = true;
  }

  saveRecord(): void {
    if (!this.currentRecord.localBodyName?.trim()) {
      this.msg.add({ severity: 'warn', summary: 'Validation', detail: 'Local Body Name is required.' });
      return;
    }

    if (this.isEditing && this.currentRecord.id) {
      const idx = this.records.findIndex(r => r.id === this.currentRecord.id);
      if (idx >= 0) {
        this.records[idx] = { ...this.currentRecord };
      }
      if (this.api) {
        this.http.put(`${this.api}/records/${this.currentRecord.id}`, this.currentRecord).pipe(catchError(() => of(null))).subscribe();
      }
      this.msg.add({ severity: 'success', summary: 'Updated', detail: 'Local Body Mapping record updated.' });
    } else {
      this.currentRecord.id = Date.now();
      this.currentRecord.sno = this.records.length + 1;
      this.records.unshift({ ...this.currentRecord });
      if (this.api) {
        this.http.post(`${this.api}/records`, this.currentRecord).pipe(catchError(() => of(null))).subscribe();
      }
      this.msg.add({ severity: 'success', summary: 'Added', detail: 'New Local Body record created.' });
    }

    this.saveToStorage(this.records);
    this.applyFilters();
    this.displayModal = false;
    this.cdr.markForCheck();
  }

  deleteRecord(record: LocalBodyMapping): void {
    this.confirm.confirm({
      message: `Are you sure you want to delete "${record.localBodyName || 'this record'}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-trash',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.records = this.records.filter(r => r.id !== record.id);
        this.saveToStorage(this.records);
        this.applyFilters();
        if (this.api && record.id) {
          this.http.delete(`${this.api}/records/${record.id}`).pipe(catchError(() => of(null))).subscribe();
        }
        this.msg.add({ severity: 'success', summary: 'Deleted', detail: 'Record removed successfully.' });
        this.cdr.markForCheck();
      }
    });
  }

  confirmClear(): void {
    this.confirm.confirm({
      message: 'Are you sure you want to clear all mapping data? This action cannot be undone.',
      header: 'Clear Mapping Records',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Clear All',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.records = [];
        this.filteredRecords = [];
        this.saveToStorage([]);
        if (this.api) {
          this.http.delete(`${this.api}/records`).pipe(catchError(() => of(null))).subscribe();
        }
        this.msg.add({ severity: 'success', summary: 'Cleared', detail: 'All mapping records have been cleared.' });
        this.cdr.markForCheck();
      }
    });
  }

  private extractRowValue(r: any, patterns: string[]): string {
    const keys = Object.keys(r);
    for (const p of patterns) {
      const target = p.toLowerCase().replace(/[\s_-]/g, '');
      for (const k of keys) {
        if (k.toLowerCase().replace(/[\s_-]/g, '') === target) {
          const val = r[k];
          if (val !== undefined && val !== null) {
            return String(val).trim();
          }
        }
      }
    }
    return '-';
  }

  onFileChange(event: any): void {
    this.onExcelSelected(event);
  }

  onExcelSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.uploading = true;
    this.cdr.markForCheck();

    // 1. Try Client-side SheetJS Parsing for instant responsiveness
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rows && rows.length > 0) {
          const parsedRecords: LocalBodyMapping[] = rows.map((r, idx) => ({
            id: Date.now() + idx,
            sno: idx + 1,
            state: this.extractRowValue(r, ['state', 'state_name']) || 'Tamil Nadu',
            division: this.extractRowValue(r, ['division', 'div']),
            district: this.extractRowValue(r, ['district', 'dist']),
            localBody: this.extractRowValue(r, ['local_body', 'localbody', 'type']),
            localBodyName: this.extractRowValue(r, ['local_body_name', 'name of the localbody', 'name', 'localbodyname']),
            block: this.extractRowValue(r, ['block', 'taluk']),
            villagePanchayat: this.extractRowValue(r, ['village_panchayat', 'village pancayet', 'panchayat']),
            corporation: this.extractRowValue(r, ['corporation', 'corrpration']),
            townPanchayat: this.extractRowValue(r, ['town_panchayat', 'townpanyptet']),
            municipality: this.extractRowValue(r, ['municipality', 'muncipality']),
            gcc: this.extractRowValue(r, ['gcc']),
            cmwssb: this.extractRowValue(r, ['cmwssb', 'cmws'])
          }));

          this.records = parsedRecords;
          this.saveToStorage(this.records);
          this.applyFilters();
          this.msg.add({ severity: 'success', summary: 'Import Successful', detail: `${parsedRecords.length} records parsed and loaded.` });
        }
      } catch (err: any) {
        this.msg.add({ severity: 'error', summary: 'Parse Error', detail: err.message || 'Failed to parse Excel file.' });
      } finally {
        this.uploading = false;
        event.target.value = '';
        this.cdr.markForCheck();
      }
    };
    reader.readAsArrayBuffer(file);

    // 2. Also send to API in background if API is available
    if (this.api) {
      const formData = new FormData();
      formData.append('file', file);
      this.http.post<any>(`${this.api}/import`, formData).pipe(catchError(() => of(null))).subscribe();
    }
  }

  exportExcel(): void {
    if (this.filteredRecords.length === 0) {
      this.msg.add({ severity: 'warn', summary: 'Export', detail: 'No records to export.' });
      return;
    }

    const exportData = this.filteredRecords.map(r => ({
      'S.No': r.sno,
      'State': r.state,
      'Division': r.division,
      'District': r.district,
      'Local Body Type': r.localBody,
      'Name of Local Body': r.localBodyName,
      'Block': r.block,
      'Village Panchayat': r.villagePanchayat,
      'Corporation': r.corporation,
      'Town Panchayat': r.townPanchayat,
      'Municipality': r.municipality,
      'GCC': r.gcc,
      'CMWSSB': r.cmwssb
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LocalBodyMapping');
    XLSX.writeFile(wb, `TAHDCO_LocalBody_Configuration_${new Date().toISOString().slice(0,10)}.xlsx`);

    this.msg.add({ severity: 'success', summary: 'Exported', detail: 'Excel spreadsheet generated and downloaded.' });
  }

  private saveToStorage(data: LocalBodyMapping[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }
}
