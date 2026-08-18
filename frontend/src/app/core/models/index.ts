// ════════════════════════════════════════════════════════════════
// TAHDCO UDP – Models, Interfaces, Constants
// ════════════════════════════════════════════════════════════════

// ── Auth ─────────────────────────────────────────────────────────
// TAHDCO hierarchy: Executive Engineer (division) → General Manager →
// Managing Director → Secretary (government oversight)
export type Role = 'dm' | 'ee' | 'ce' | 'Chief Engineer' | 'gm' | 'md' | 'secretary' | 'admin';
export type Scope = 'district' | 'division' | 'all';

// ── Dashboard "lenses" ───────────────────────────────────────────
export type DashboardMode = 'strategic' | 'operational' | 'analytical' | 'tactical';

export interface RoleMeta {
  role: Role;
  short: string;        // EE / GM / MD / SEC / CE
  label: string;        // full title
  scopeLabel: string;   // e.g. "Division"
  badgeClass: string;   // badge colour class
  defaultMode: DashboardMode;
}

export const ROLE_META: Record<string, RoleMeta> = {
  dm:               { role: 'dm',             short: 'DM',    label: 'District Manager',   scopeLabel: 'District',          badgeClass: 'b-orange', defaultMode: 'tactical'    },
  ee:               { role: 'ee',             short: 'EE',    label: 'Executive Engineer', scopeLabel: 'Division',          badgeClass: 'b-teal',   defaultMode: 'operational' },
  ce:               { role: 'ce',             short: 'CE',    label: 'Chief Engineer',     scopeLabel: 'State Engineering', badgeClass: 'b-indigo', defaultMode: 'strategic'   },
  'Chief Engineer': { role: 'Chief Engineer', short: 'CE',    label: 'Chief Engineer',     scopeLabel: 'State Engineering', badgeClass: 'b-indigo', defaultMode: 'strategic'   },
  gm:               { role: 'gm',             short: 'GM',    label: 'General Manager',    scopeLabel: 'Corporate',         badgeClass: 'b-gold',   defaultMode: 'tactical'    },
  md:               { role: 'md',             short: 'MD',    label: 'Managing Director',  scopeLabel: 'Corporation',       badgeClass: 'b-navy',   defaultMode: 'strategic'   },
  secretary:        { role: 'secretary',      short: 'SEC',   label: 'Secretary',          scopeLabel: 'Government',        badgeClass: 'b-purple', defaultMode: 'strategic'   },
  admin:            { role: 'admin',          short: 'ADMIN', label: 'Application Admin',      scopeLabel: 'System',            badgeClass: 'b-red',    defaultMode: 'strategic'   },
};

export interface DashboardLens {
  mode: DashboardMode;
  title: string;
  tagline: string;
  icon: string;
  accentVar: string;      // css var name for the lens accent
  accentSoftVar: string;
}

export const DASHBOARD_LENSES: DashboardLens[] = [
  { mode: 'strategic',   title: 'Strategic',   tagline: 'Outcomes vs annual targets',        icon: 'pi-compass',      accentVar: 'var(--lens-strategic)',   accentSoftVar: 'var(--lens-strategic-soft)' },
  { mode: 'tactical',    title: 'Tactical',    tagline: 'Division performance & bottlenecks', icon: 'pi-sliders-h',    accentVar: 'var(--lens-tactical)',    accentSoftVar: 'var(--lens-tactical-soft)' },
  { mode: 'operational', title: 'Operational', tagline: 'Live status, today & alerts',         icon: 'pi-bolt',         accentVar: 'var(--lens-operational)', accentSoftVar: 'var(--lens-operational-soft)' },
  { mode: 'analytical',  title: 'Analytical',  tagline: 'Deep-dive trends & distributions',   icon: 'pi-chart-scatter',accentVar: 'var(--lens-analytical)',  accentSoftVar: 'var(--lens-analytical-soft)' },
];

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  scope: Scope;
  districtId?: number;
  districtName?: string;
  divisionId?: number;
  divisionName?: string;
  appAccess: string[];
  /** Per-project privilege flags (Create / Edit / Update / Delete / View). */
  privileges?: Record<string, ProjectPrivilege>;
  isActive: boolean;
  lastLogin?: string;
}

export interface ProjectPrivilege {
  view: boolean;
  create: boolean;
  edit: boolean;
  update: boolean;
  delete: boolean;
}

export interface LoginRequest { email: string; password: string; }
export interface LoginResponse { token: string; user: User; }

// ── Filter state ─────────────────────────────────────────────────
export interface FilterState {
  financialYear: string;
  division: string;
  district: string;
  phase: string;
}

// ── Dashboard KPI ─────────────────────────────────────────────────
export interface KpiCard {
  id: string;
  label: string;
  value: number;
  subLabel: string;
  subValue: string | number;
  icon: string;
  accent: string;
  accentSoft: string;
  trend: 'up' | 'down' | 'neutral';
  detail: { label: string; value: number; color: string }[];
}

// ── Tender ────────────────────────────────────────────────────────
export interface TenderSummary {
  totalWorks: number;
  started: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  slowProgress: number;
  mBookTotal: number;
  mBookUploaded: number;
  mBookPending: number;
  noAction: number;
  paymentPending: number;
}

export interface TenderDivisionCount {
  division: string;
  totalWorks: number;
  inProgress: number;
  notStarted: number;
  completed: number;
  mBooks: number;
}

export interface TenderDistrictCount {
  sno: number;
  division: string;
  district: string;
  totalWorks: number;
  started: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  slowProgress: number;
  mBookUploaded: number;
  mBookPending: number;
  noAction: number;
  paymentPending: number;
}

export interface TenderWork {
  sno: number;
  division: string;
  district: string;
  tenderRef: string;
  workType: string;
  contractorName: string;
  awardedDate: string;
  amount: number;
  status: 'In-Progress' | 'Not-Started' | 'Slow-Progress' | 'Stilled' | 'Completed';
}

export interface MBook {
  sno: number;
  division: string;
  district: string;
  workId: string;
  measurementDate: string;
  amount: number;
  status: 'Saved' | 'Approved' | 'Payment-Pending' | 'No-Action';
}

// ── Housing ───────────────────────────────────────────────────────
export interface HousingOverall {
  totalHouses: number;
  started: number;
  notStarted: number;
  completed: number;
  gradBeam: number;
  basement: number;
  lintelLevel: number;
  roofLevel: number;
  completion: number;
}

export interface HousingDistrict {
  sno: number;
  division: string;
  district: string;
  phase: string;
  totalHouses: number;
  started: number;
  notStarted: number;
  completed: number;
  gradBeam: number;
  basement: number;
  lintelLevel: number;
  roofLevel: number;
  completion: number;
}

export interface HousingDivisionSummary {
  division: string;
  totalHouses: number;
  completed: number;
  started: number;
  notStarted: number;
}

// ── Scheme ────────────────────────────────────────────────────────
export interface SchemeItem {
  sno: number;
  project: string;
  scheme: string;
  subScheme: string;
  apply: number;
  dmPending: number;
  hqPending: number;
  paymentPending: number;
}

export interface SchemeDistrictBreakdown {
  district: string;
  division: string;
  apply: number;
  dmPending: number;
  hqPending: number;
  paymentPending: number;
}

// ── Enrollment (TAMS) ─────────────────────────────────────────────
export interface EnrollSummary {
  totalStudents: number;
  present: number;
  attendancePct: number;
  newEnrollment: number;
  totalCourses: number;
  newCourses: number;
  totalInstitutes: number;
  newInstitutes: number;
  male: number;
  female: number;
  others: number;
}

export interface EnrollInstitute {
  sno: number;
  division: string;
  district: string;
  institute: string;
  course: string;
  status: string;
  totalStudents: number;
  present: number;
  attendancePct: number;
  grade: string;
}

export interface EnrollDivisionSummary {
  division: string;
  students: number;
  present: number;
  attendancePct: number;
}

export interface GradeDistribution {
  excellent: number;
  good: number;
  average: number;
  poor: number;
}

export interface EnrollDistrict {
  district: string;
  total: number;
  completed: number;
  ongoing: number;
}

export interface MonthlyCompletion {
  month: string;
  count: number;
}

// ── TOD ───────────────────────────────────────────────────────────
export interface TodSummary {
  totalTasks: number;
  totalEvents: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface TodDistrict {
  district: string;
  taskType: string;
  taskCount: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

// ── Patrol360 ─────────────────────────────────────────────────────
export interface PatrolSummary {
  totalWorks: number;
  started: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  cameraInstalled: number;
  currentActive: number;
  currentInactive: number;
}

export interface PatrolDistrict {
  district: string;
  division: string;
  totalWorks: number;
  started: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  cameraInstalled: number;
  currentActive: number;
  currentInactive: number;
}

export interface OfflineDuration {
  lessThan2Days: number;
  between3To10Days: number;
  moreThan10Days: number;
}

// ── Chart ─────────────────────────────────────────────────────────
export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor: string | string[];
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  barThickness?: number;
  fill?: boolean;
  tension?: number;
  pointRadius?: number;
}

export interface ChartConfig {
  labels: string[];
  datasets: ChartDataset[];
}

// ── Constants ─────────────────────────────────────────────────────
export const PALETTE = {
  navy:        '#0a1628',
  navyMid:     '#1a3461',
  navyLight:   '#1e4080',
  navySoft:    '#e8edf5',
  gold:        '#c9a227',
  goldMid:     '#d4af37',
  goldSoft:    '#fdf8e8',
  success:     '#1e7c4c',
  successSoft: '#edf7f2',
  warning:     '#c47a0a',
  warningSoft: '#fef8e7',
  danger:      '#c0392b',
  dangerSoft:  '#fef0ef',
  info:        '#1a5fa5',
  infoSoft:    '#eaf2fb',
  gray200:     '#e0e0eb',
  gray400:     '#9898aa',
  gray600:     '#555569',
};

export const DIVISIONS = [
  'All Divisions','Chennai','Coimbatore','Madurai','Salem',
  'Thanjavur','Trichy','Vellore','Villupuram','Thirunelveli'
];

export const FINANCIAL_YEARS = [
  'All Years', 'FY 2026-27', 'FY 2025-26', 'FY 2024-25', 'FY 2023-24', 'FY 2022-23'
];

export const PHASES = ['All Phases','Phase 1','Phase 2','Phase 3','Phase 4'];

export const DISTRICTS_BY_DIVISION: Record<string, string[]> = {
  'Chennai':      ['Chengalpattu','Kancheepuram','Tiruvallur','Ranipet'],
  'Coimbatore':   ['Coimbatore','Erode','Tiruppur','The Nilgiris'],
  'Madurai':      ['Madurai','Dindigul','Theni','Sivagangai','Ramanathapuram'],
  'Salem':        ['Salem','Dharmapuri','Krishnagiri','Namakkal','Karur'],
  'Thanjavur':    ['Thanjavur','Thiruvarur','Nagapattinam','Mayiladuthurai'],
  'Trichy':       ['Ariyalur','Perambalur','Thiruchirappalli','Pudukkottai'],
  'Vellore':      ['Vellore','Tirupathur','Tiruvannamalai'],
  'Villupuram':   ['Villupuram','Cuddalore','Kallakurichi'],
  'Thirunelveli': ['Tirunelveli','Tenkasi','Thoothukudi','Kanniyakumari'],
};

export const APP_LIST = [
  'TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'
];

// ── One Portal & TELP ────────────────────────────────────────────
export interface MemberDistrict {
  division: string;
  district: string;
  totalWorks: number;
  save: number;
  dmPending: number;
  hqPending: number;
  cardInProgress: number;
  cardIssued: number;
}

export interface TelpAgency {
  agency: string;
  apply: number;
  dmPending: number;
  hqPending: number;
}

// ── Unified overview landing tile ────────────────────────────────
export interface ModuleTile {
  id: string;
  code: string;          // TIPS, THMS, TAMS…
  name: string;          // full module name
  route: string;         // navigation target
  app?: string;          // app-access key for role gating
  icon: string;          // tabler/pi icon
  accent: string;        // hex accent colour
  accentSoft: string;    // soft background hex
  primaryValue: number;  // headline figure
  primaryLabel: string;  // headline caption
  stats: { label: string; value: number | string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }[];
}

// ── Drill-down dashboard model ───────────────────────────────────
export interface DrillRow {
  key: string;              // unique row id (division / district / scheme)
  label: string;            // display name
  value: number;            // primary bar value
  segments: {               // stacked/detail breakdown for this row
    label: string;
    value: number;
    color: string;
  }[];
  extra?: Record<string, number | string>;  // extra fields for the detail panel
}

export interface DrillConfig {
  moduleId: string;
  moduleName: string;
  moduleCode: string;
  accent: string;
  accentSoft: string;
  icon: string;
  valueLabel: string;       // caption for primary value (e.g. "Total works")
  segmentLegend: { label: string; color: string }[];
  rows: DrillRow[];
}

// ── Multi-Module Dashboard Cache (api/v2/dashboard-cache) ──────────
// Mirrors backend Model.ViewModel.DashboardAdapterModels.cs exactly — module keys,
// field names, and the CACHE/API/NONE + FRESH/STALE/API_FAILED/EMPTY vocab must stay
// in lockstep with the .NET DTOs so the frontend never re-derives its own meaning
// for a status string.

export type DashboardModuleKey =
  | 'TELP' | 'TAHDCO_SCHEME' | 'TIME_PATROL360' | 'THMS' | 'TAMS'
  | 'ONE_PORTAL_MEMBER' | 'ONE_PORTAL_SCHEME';

export type DataSourceKind = 'CACHE' | 'API' | 'NONE';
export type CacheStatusKind = 'FRESH' | 'STALE' | 'API_FAILED' | 'EMPTY';

export interface DashboardModuleConfig {
  key: DashboardModuleKey;
  label: string;
  code: string;      // short chip label
  icon: string;       // pi-* icon
  app: string;        // AuthService.hasAppAccess() key — reuses the same app-gating strings as APP_LIST
}

/** Client-side mirror of DashboardModule.All (backend/Model/ViewModel/DashboardAdapterModels.cs).
 * Adding an 8th module server-side means adding one row here too — nothing else in the
 * dashboard-cache UI is hard-coded to a module count. */
export const DASHBOARD_MODULES: DashboardModuleConfig[] = [
  { key: 'TELP',              label: 'TELP Land Purchase',        code: 'TELP',      icon: 'pi-book',           app: 'TELP' },
  { key: 'TAHDCO_SCHEME',     label: 'TAHDCO Scheme',             code: 'Scheme',    icon: 'pi-wallet',         app: 'Scheme' },
  { key: 'TIME_PATROL360',    label: 'TIME + Patrol360',          code: 'TIME',      icon: 'pi-video',          app: 'Patrol360' },
  { key: 'THMS',               label: 'Housing (THMS)',            code: 'THMS',      icon: 'pi-building',       app: 'THMS' },
  { key: 'TAMS',               label: 'Skill Enrollment (TAMS)',   code: 'TAMS',      icon: 'pi-graduation-cap', app: 'TAMS' },
  { key: 'ONE_PORTAL_MEMBER', label: 'One Portal – Member',       code: 'OP-Member', icon: 'pi-id-card',        app: 'OnePortal' },
  { key: 'ONE_PORTAL_SCHEME', label: 'One Portal – Scheme',       code: 'OP-Scheme', icon: 'pi-briefcase',      app: 'OnePortal' },
];

/** Every dashboard click must resolve to this before any DETAIL API call or cache lookup —
 * never send a bare count. Field names match ClickContextDto (Model.ViewModel) exactly so the
 * object can be POSTed to api/v2/dashboard-cache/{module}/detail with no remapping. */
export interface ClickContext {
  module: DashboardModuleKey | string;
  district?: string | null;
  division?: string | null;
  /** The clicked column's category in the module's own vocabulary (e.g. "IN_PROGRESS", "statusSavedCount", "HqPending"). */
  metric: string;
  /** The count value that was clicked — informational only, never used to identify the record. */
  count?: number;
  filters?: Record<string, any>;
  page?: number;
  pageSize?: number;
  query?: string | null;
}

export interface NormalizedCount {
  module: string;
  district?: string | null;
  division?: string | null;
  metric: string;
  value: number;
  filters?: Record<string, any>;
  source: DataSourceKind;
  fetchedAt?: string;
}

export interface NormalizedDetailRecord {
  module: string;
  recordId?: string | null;
  district?: string | null;
  division?: string | null;
  metric?: string | null;
  data: Record<string, any>;
  source: DataSourceKind;
  fetchedAt?: string;
  stale?: boolean;
}

/** The exact {data, source, stale, unavailable} envelope every dashboard-cache endpoint returns
 * (CacheResultDto<T> on the backend) — the UI must branch on `unavailable`/`stale` rather than
 * ever inferring freshness from whether `data` happens to be empty. */
export interface DashboardCacheResult<T> {
  data: T | null;
  source: DataSourceKind;
  stale: boolean;
  unavailable: boolean;
  lastSuccessfulFetch?: string | null;
  cacheStatus: CacheStatusKind;
  message?: string | null;
}

export interface DashboardDataStatus {
  exists: boolean;
  fresh: boolean;
  stale: boolean;
  lastSuccessfulFetch?: string | null;
  recordCount: number;
}

export interface DashboardRefreshResult {
  triggered: boolean;
  success: boolean;
  message?: string | null;
}
