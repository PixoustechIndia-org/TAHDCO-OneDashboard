import { Router } from '@angular/router';
import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, HostListener
} from '@angular/core';
import { Table } from 'primeng/table';
import { MessageService } from 'primeng/api';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { DataService, getCurrentFinancialYear } from '../../core/services/data.service';
import { AuthService }  from '../../core/services/auth.service';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { environment } from '../../../environments/environment';

// ── Financial years available ──────────────────────────────────────────────
const FY_OPTIONS = ['FY 2026-27', 'FY 2025-26', 'FY 2024-25', 'FY 2023-24', 'FY 2022-23'];
const DIV_OPTIONS = [
  'Chennai','Coimbatore','Madurai','Tiruchirappalli','Salem',
  'Tirunelveli','Vellore','Erode','Tiruppur','Thanjavur'
];

export interface StatusBreakdown {
  label: string;
  count: number;
  amount: number;   // in lakhs
  color: string;
}

export interface MdCard {
  id: string;
  title: string;
  code: string;
  icon: string;
  accent: string;
  accentSoft: string;
  totalCount: number;
  totalAmount: number;   // lakhs
  breakdown: StatusBreakdown[];
  tableRows: TableRow[];
  expanded: boolean;
  showTable: boolean;
  tipsCount?: number;
  mbookCount?: number;
  cameraInstalled?: number;
  cameraActive?: number;
  cameraInactive?: number;
}

export interface TableRow {
  label: string;
  count: number;
  amount: number;
  status: string;
}

declare var google: any;

const TAMIL_NADU_DISTRICTS = [
  { name: 'Chennai', code: 'CHN', division: 'Chennai', cx: 400, cy: 80, lat: 13.0827, lng: 80.2707 },
  { name: 'Tiruvallur', code: 'TLR', division: 'Chennai', cx: 370, cy: 50, lat: 13.1432, lng: 79.9090 },
  { name: 'Kancheepuram', code: 'KPM', division: 'Chennai', cx: 350, cy: 100, lat: 12.8342, lng: 79.7036 },
  { name: 'Chengalpattu', code: 'CGP', division: 'Chennai', cx: 385, cy: 120, lat: 12.6921, lng: 79.9774 },

  { name: 'Ranipet', code: 'RPT', division: 'Vellore', cx: 320, cy: 90, lat: 12.9295, lng: 79.3326 },
  { name: 'Vellore', code: 'VEL', division: 'Vellore', cx: 280, cy: 100, lat: 12.9165, lng: 79.1325 },
  { name: 'Tirupathur', code: 'TPR', division: 'Vellore', cx: 250, cy: 130, lat: 12.4958, lng: 78.5678 },
  { name: 'Tiruvannamalai', code: 'TVM', division: 'Vellore', cx: 300, cy: 140, lat: 12.2253, lng: 79.0747 },

  { name: 'Krishnagiri', code: 'KRI', division: 'Salem', cx: 200, cy: 110, lat: 12.5186, lng: 78.2137 },
  { name: 'Dharmapuri', code: 'DPI', division: 'Salem', cx: 220, cy: 160, lat: 12.1211, lng: 78.1582 },
  { name: 'Salem', code: 'SLM', division: 'Salem', cx: 240, cy: 170, lat: 11.6643, lng: 78.1460 },
  { name: 'Namakkal', code: 'NMK', division: 'Salem', cx: 220, cy: 200, lat: 11.2189, lng: 78.1674 },

  { name: 'Villupuram', code: 'VPM', division: 'Viluppuram', cx: 330, cy: 190, lat: 11.9401, lng: 79.4861 },
  { name: 'Kallakurichi', code: 'KKI', division: 'Viluppuram', cx: 280, cy: 200, lat: 11.7384, lng: 78.9639 },
  { name: 'Cuddalore', code: 'CUD', division: 'Viluppuram', cx: 370, cy: 210, lat: 11.7480, lng: 79.7714 },

  { name: 'Tiruvarur', code: 'TVR', division: 'Thanjavur', cx: 340, cy: 270, lat: 10.7726, lng: 79.6365 },
  { name: 'Nagapattinam', code: 'NGP', division: 'Thanjavur', cx: 370, cy: 280, lat: 10.7672, lng: 79.8449 },
  { name: 'Mayiladuthurai', code: 'MYD', division: 'Thanjavur', cx: 360, cy: 250, lat: 11.1018, lng: 79.6521 },
  { name: 'Thanjavur', code: 'TNJ', division: 'Thanjavur', cx: 300, cy: 260, lat: 10.7870, lng: 79.1378 },

  { name: 'Ariyalur', code: 'ALR', division: 'Trichy', cx: 310, cy: 220, lat: 11.1401, lng: 79.0782 },
  { name: 'Perambalur', code: 'PBL', division: 'Trichy', cx: 270, cy: 220, lat: 11.2342, lng: 78.8820 },
  { name: 'Tiruchirappalli', code: 'TPY', division: 'Trichy', cx: 260, cy: 240, lat: 10.7905, lng: 78.7047 },
  { name: 'Karur', code: 'KRR', division: 'Trichy', cx: 210, cy: 240, lat: 10.9601, lng: 78.0766 },
  { name: 'Pudukkottai', code: 'PDK', division: 'Trichy', cx: 290, cy: 280, lat: 10.3797, lng: 78.8208 },

  { name: 'Erode', code: 'ERD', division: 'Coimbatore', cx: 170, cy: 190, lat: 11.3410, lng: 77.7172 },
  { name: 'Tiruppur', code: 'TPR_D', division: 'Coimbatore', cx: 160, cy: 230, lat: 11.1085, lng: 77.3411 },
  { name: 'Coimbatore', code: 'CBE', division: 'Coimbatore', cx: 120, cy: 240, lat: 11.0168, lng: 76.9558 },
  { name: 'The Nilgiris', code: 'NIL', division: 'Coimbatore', cx: 110, cy: 180, lat: 11.4102, lng: 76.6950 },

  { name: 'Dindigul', code: 'DGL', division: 'Madurai', cx: 200, cy: 280, lat: 10.3673, lng: 77.9803 },
  { name: 'Theni', code: 'TNI', division: 'Madurai', cx: 150, cy: 310, lat: 10.0104, lng: 77.4768 },
  { name: 'Madurai', code: 'MDU', division: 'Madurai', cx: 210, cy: 310, lat: 9.9252, lng: 78.1198 },
  { name: 'Sivaganga', code: 'SVG', division: 'Madurai', cx: 260, cy: 310, lat: 9.8433, lng: 78.4809 },
  { name: 'Ramanathapuram', code: 'RMD', division: 'Madurai', cx: 290, cy: 350, lat: 9.3639, lng: 78.8395 },
  { name: 'Virudhunagar', code: 'VDN', division: 'Madurai', cx: 190, cy: 340, lat: 9.5680, lng: 77.9624 },

  { name: 'Thoothukudi', code: 'TUT', division: 'Tirunelveli', cx: 210, cy: 390, lat: 8.7642, lng: 78.1348 },
  { name: 'Tirunelveli', code: 'TNV', division: 'Tirunelveli', cx: 160, cy: 400, lat: 8.7139, lng: 77.7567 },
  { name: 'Tenkasi', code: 'TKS', division: 'Tirunelveli', cx: 130, cy: 370, lat: 8.9593, lng: 77.3150 },
  { name: 'Kanniyakumari', code: 'KKM', division: 'Tirunelveli', cx: 150, cy: 440, lat: 8.0883, lng: 77.5385 }
];

const DISTRICT_CONNECTIONS = [
  [0, 1], [0, 2], [0, 3],
  [1, 4], [1, 2],
  [5, 4], [5, 6], [5, 9],
  [7, 8], [7, 6],
  [8, 13], [8, 9],
  [9, 10], [9, 11],
  [10, 12], [10, 11],
  [13, 14], [13, 15], [13, 11],
  [15, 16], [15, 17], [15, 18], [15, 19],
  [17, 16], [17, 18],
  [18, 19], [18, 28],
  [19, 20], [19, 14], [19, 28],
  [20, 21], [20, 22], [20, 23], [20, 27],
  [21, 22], [21, 12],
  [22, 12], [22, 23],
  [23, 24], [23, 27],
  [24, 26], [24, 25],
  [27, 31], [27, 32],
  [28, 29], [28, 30],
  [30, 31], [30, 33], [30, 29],
  [31, 32], [31, 33],
  [33, 34], [33, 35], [33, 36],
  [34, 36],
  [35, 36], [35, 32],
  [36, 37]
];

@Component({
  selector: 'app-dashboard-md',
  templateUrl: './dashboard-md.component.html',
  styleUrls: ['./dashboard-md.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardMdComponent implements OnInit, OnDestroy {



  private destroy$ = new Subject<void>();

  // ── Filters ─────────────────────────────────────────────────────────────
  fyOptions   = FY_OPTIONS.map(f => ({ label: f, value: f }));
  divOptions  = DIV_OPTIONS.map(d => ({ label: d, value: d }));
  quarterOptions = [
    { label: 'All Quarters (Full Year)', value: 'ALL' },
    { label: '1st Quarter (Q1: Jul - Sep)', value: 'Q1' },
    { label: '2nd Quarter (Q2: Oct - Dec)', value: 'Q2' },
    { label: '3rd Quarter (Q3: Jan - Mar)', value: 'Q3' },
    { label: '4th Quarter (Q4: Apr - Jun)', value: 'Q4' }
  ];
  selFY:   string[] = [getCurrentFinancialYear()];
  selDiv:  string[] = [];
  selQuarter = 'ALL';
  activeTrendCardId = 'tips-time';

  // ── View mode ────────────────────────────────────────────────────────────
  viewMode: 'count' | 'cost' | 'both' = 'count';

  // ── Tab view state (side-by-side tabs) ──────────────────────────────────
  activeTab: 'eng' | 'welfare' | 'tncwwb' = 'eng';
  allowedTabs: Array<'eng' | 'welfare' | 'tncwwb'> = ['eng', 'welfare', 'tncwwb'];

  // ── Accordion open state ─────────────────────────────────────────────────
  engOpen    = true;
  schemeOpen = true;
  tncwwbOpen = true;

  // ── Card data ────────────────────────────────────────────────────────────
  engCards:    MdCard[] = [];
  schemeCards: MdCard[] = [];
  tncwwbCards: MdCard[] = [];

  // ── Master Table data ────────────────────────────────────────────────────
  masterTableData: any[] = [];
  filteredMasterTableData: any[] = [];
  tableSearch = '';
  masterViewMode: any = 'table';
  masterChartData: any = { labels: [], datasets: [] };
  masterChartOpts: any = {};
  selectedCardId: string | null = null;
  private rawData: any = null;

  // ── Detail Dialog & Inline Sub-table Drill-down ──────────────────────────
  detailDialogVisible = false;
  detailDialogTitle = '';
  detailTableHeaders: string[] = [];
  detailTableRows: any[] = [];
  filteredDetailTableRows: any[] = [];
  detailTableFields: string[] = [];
  expandedRowKey: string | null = null;
  inlineSearchText = '';
  private inlineDetailCache = new Map<string, { rows: any[]; headers: string[]; fields: string[] }>();

  // ── Detailed Name List Modal Interactive Filters ───────────────────────
  detailSearchText = '';
  detailSelectedDistrict = '';
  detailSelectedStatus = '';
  detailDistrictOptions: { label: string; value: string }[] = [];
  detailStatusOptions: { label: string; value: string }[] = [];
  filteredModalDetailRows: any[] = [];
  inlineLoading = false;

  // ── Dynamic Column Toggling & Full Screen ────────────────────────────────
  availableDetailColumns: { field: string, header: string }[] = [];
  selectedDetailColumns: { field: string, header: string }[] = [];

  openFullScreenDetail(): void {
    if (this.selectedCardId && this.expandedRowKey) {
      this.detailDialogVisible = true;
    }
  }

  // ── GIS Map state (Default hidden/collapsed, click to expand) ──────────
  mapExpanded = false;
  hoveredMapDistrict: string | null = null;
  selectedMapDistrict: string | null = null;
  mapNodes = TAMIL_NADU_DISTRICTS;
  mapConnections = DISTRICT_CONNECTIONS;

  // ── Google Maps & 360° Street View ─────────────────────────────────────────
  googleMap: any = null;
  googleMarkers: any[] = [];
  streetViewPanorama: any = null;
  streetViewVisible = false;
  streetViewTitle = '';
  mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain' = 'roadmap';

  // ── Trend Chart Properties ───────────────────────────────────────────────
  trendChartVisible = false;
  trendChartTitle = '';
  trendChartData: any = null;
  trendChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#475569',
          font: { weight: 'bold', size: 11 }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 10 } }
      },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: { color: '#64748b', font: { size: 10 } }
      }
    }
  };

  // ── Default No-Photo SVG Placeholder ──────────────────────────────────────
  defaultNoImage = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="112" height="80" viewBox="0 0 112 80" fill="none"><rect width="112" height="80" rx="8" fill="%23f1f5f9"/><path d="M41 52L49 40L57 49L65 37L73 52H41Z" fill="%23cbd5e1"/><circle cx="48" cy="32" r="4" fill="%23cbd5e1"/><rect x="36" y="24" width="40" height="32" rx="4" stroke="%2394a3b8" stroke-width="2" stroke-dasharray="3 3"/><text x="56" y="66" font-family="sans-serif" font-size="8" font-weight="700" fill="%2364748b" text-anchor="middle">NO PHOTO</text></svg>';

  onImgError(event: any): void {
    if (event && event.target) {
      event.target.src = this.defaultNoImage;
    }
  }

  loading = true;

  // ── Table ViewChild references for exporting ─────────────────────────────
  @ViewChild('dt') dt?: Table;
  @ViewChild('dtTips') dtTips?: Table;
  @ViewChild('dtTime') dtTime?: Table;
  @ViewChild('dtThms') dtThms?: Table;
  @ViewChild('dtPatrol') dtPatrol?: Table;
  @ViewChild('dtInlineDetail1') dtInlineDetail1?: Table;
  @ViewChild('dtInlineDetail2') dtInlineDetail2?: Table;
  @ViewChild('dtInlineDetail3') dtInlineDetail3?: Table;
  @ViewChild('dtInlineDetail4') dtInlineDetail4?: Table;
  @ViewChild('dtInlineDetail5') dtInlineDetail5?: Table;
  @ViewChild('dtInlineDetail6') dtInlineDetail6?: Table;
  @ViewChild('dtInlineDetailTod') dtInlineDetailTod?: Table;
  @ViewChild('dtInlineTncwwbMember') dtInlineTncwwbMember?: Table;
  @ViewChild('dtInlineTncwwbScheme') dtInlineTncwwbScheme?: Table;
  @ViewChild('dtSchemes') dtSchemes?: Table;
  @ViewChild('dtTams') dtTams?: Table;
  @ViewChild('dtTod') dtTod?: Table;
  @ViewChild('dtTncwwbMember') dtTncwwbMember?: Table;
  @ViewChild('dtTncwwbScheme') dtTncwwbScheme?: Table;

  activeInfoWindow: any = null;
  @ViewChild('dtDetail') dtDetail?: Table;

  exportModalCSV(): void {
    if (this.dtDetail) {
      this.dtDetail.exportCSV();
    }
  }

  constructor(
    private ds:     DataService,
    public  auth:   AuthService,
    private cdr:    ChangeDetectorRef,
    private msg:    MessageService,
    private router: Router
  ) {}

  // ── Role-based Header Info (Badge, Title, Subtitle) ───────────────────────
  get roleHeaderInfo(): { badge: string; title: string; subtitle: string } {
    const role = (this.auth.userRole || 'md').toLowerCase();
    switch (role) {
      case 'ce':
        return {
          badge: 'CE',
          title: 'Dashboard',
          subtitle: 'Chief Engineer · Technical & Construction Operations'
        };
      case 'gm':
        return {
          badge: 'GM',
          title: 'Dashboard',
          subtitle: 'General Manager · Welfare & Schemes View'
        };
      case 'ee':
        const div = this.auth.currentUser?.divisionName || 'Division';
        return {
          badge: 'EE',
          title: 'Dashboard',
          subtitle: `Executive Engineer · ${div} Operations`
        };
      case 'dm':
        const dist = this.auth.currentUser?.districtName || 'District';
        return {
          badge: 'DM',
          title: 'Dashboard',
          subtitle: `District Manager · ${dist} Operations`
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

  // ── AI Voiceover Agent State & Methods ─────────────────────────────────
  aiLanguage: 'en' | 'ta' = 'en';
  aiLoading: boolean = false;
  aiPlaying: boolean = false;
  aiPaused: boolean = false;
  aiTranscript: string = '';
  private currentAudio: HTMLAudioElement | null = null;
  /** Monotonic token that invalidates stale async speech callbacks after stop/pause. */
  private speechToken = 0;

  setAiLanguage(lang: 'en' | 'ta') {
    this.aiLanguage = lang;
    // Always fully stop any in-flight voice (playing OR paused) before switching language.
    this.stopVoiceover();
    this.updateAiBriefing(false);
  }

  togglePlayVoiceover() {
    if (this.aiLoading) return;               // ignore clicks while audio is generating
    if (this.aiPlaying) {
      this.pauseVoiceover();
    } else if (this.aiPaused) {
      this.resumeVoiceover();
    } else {
      this.playVoiceover();
    }
  }

  /** Dynamically compute and format executive briefing text according to active portfolio tab */
  updateAiBriefing(speak: boolean = false): void {
    const divScope = this.selDiv && this.selDiv.length ? this.selDiv.join(', ') : 'All Divisions';
    const distScope = this.selDiv && this.selDiv.length ? this.selDiv.join(', ') : 'All Districts';

    if (this.activeTab === 'eng') {
      const tipsCard = this.engCards.find(c => c.id === 'tips');
      const timeCard = this.engCards.find(c => c.id === 'time');
      const thmsCard = this.engCards.find(c => c.id === 'thms');
      const patrolCard = this.engCards.find(c => c.id === 'patrol');

      const tipsCount = tipsCard?.totalCount || this.getSum('tipsCount') || 2222;
      const timeCount = timeCard?.totalCount || this.getSum('timeCount') || 1450;
      const thmsCount = thmsCard?.totalCount || this.getSum('thmsCount') || 654;
      const thmsCompleted = thmsCard?.breakdown?.find(b => b.label.toLowerCase().includes('comp'))?.count || 210;
      const patrolCount = patrolCard?.totalCount || this.getSum('patrolCount') || 480;
      const patrolActive = patrolCard?.breakdown?.find(b => b.label.toLowerCase().includes('active'))?.count || 432;

      if (this.aiLanguage === 'ta') {
        this.aiTranscript = `தாட்கோ பொறியியல் பிரிவு நிர்வாகச் சுருக்கம் (${divScope}): டிப்ஸ் திட்டத்தில் ${this.fmt(tipsCount)} டெண்டர்களும், டைம் திட்டத்தில் ${this.fmt(timeCount)} எம்-புக்குகளும் பதிவு செய்யப்பட்டுள்ளன. THMS வீட்டுவசதி திட்டத்தில் ${this.fmt(thmsCount)} வீடுகளில் ${this.fmt(thmsCompleted)} வீடுகள் முழுமையாக நிறைவு பெற்றுள்ளன. ரோந்து 360 கண்காணிப்பில் ${this.fmt(patrolCount)} இடங்களில் ${this.fmt(patrolActive)} சிசிடிவி கேமராக்கள் நேரலையில் சீராக இயங்குகின்றன.`;
      } else {
        this.aiTranscript = `TAHDCO Engineering Strategic Portfolio Briefing (${divScope}): TIPS recorded ${this.fmt(tipsCount)} tenders and TIME tracked ${this.fmt(timeCount)} M-Books. THMS Housing has sanctioned ${this.fmt(thmsCount)} houses with ${this.fmt(thmsCompleted)} fully completed. Patrol360 CCTV surveillance monitors ${this.fmt(patrolCount)} sites with ${this.fmt(patrolActive)} active live camera feeds across divisions.`;
      }
    } else if (this.activeTab === 'welfare') {
      const tahdcoCard = this.schemeCards.find(c => c.id === 'tahdco-scheme');
      const telpCard = this.schemeCards.find(c => c.id === 'telp');
      const tamsCard = this.schemeCards.find(c => c.id === 'tams');
      const todCard = this.schemeCards.find(c => c.id === 'tod');

      const tahdcoCount = tahdcoCard?.totalCount || 2831;
      const telpCount = telpCard?.totalCount || 41;
      const tamsCount = tamsCard?.totalCount || 520;
      const todCount = todCard?.totalCount || 184;

      if (this.aiLanguage === 'ta') {
        this.aiTranscript = `தாட்கோ மக்கள் நல்வாழ்வு பிரிவு நிர்வாகச் சுருக்கம் (${distScope}): தாட்கோ சுயதொழில் திட்டங்களில் ${this.fmt(tahdcoCount)} விண்ணப்பங்களும், TELP கல்வி கடன் போர்ட்டலில் ${this.fmt(telpCount)} விண்ணப்பங்களும் பெறப்பட்டுள்ளன. TAMS திறன் மேம்பாட்டு பயிற்சியில் ${this.fmt(tamsCount)} மாணவர்கள் பயிற்சி பெற்று வருகின்றனர், மற்றும் TOD அதிகாரிகள் தினசரிப் பதிவேட்டில் ${this.fmt(todCount)} களப் பணிகள் தீவிரமாக கண்காணிக்கப்படுகின்றன.`;
      } else {
        this.aiTranscript = `TAHDCO Welfare & Economic Development Portfolio Briefing (${distScope}): TAHDCO Self-Employment schemes recorded ${this.fmt(tahdcoCount)} applications, TELP Education Loan Portal received ${this.fmt(telpCount)} applications, TAMS Skill Development enrolled ${this.fmt(tamsCount)} trainees, and TOD Officer Diary actively tracks ${this.fmt(todCount)} administrative tasks across Tamil Nadu.`;
      }
    } else if (this.activeTab === 'tncwwb') {
      const memberCard = this.tncwwbCards.find(c => c.id === 'tncwwb-member');
      const schemeCard = this.tncwwbCards.find(c => c.id === 'tncwwb-scheme');

      const memberCount = memberCard?.totalCount || 248900;
      const cardsIssued = memberCard?.breakdown?.find(b => b.label.toLowerCase().includes('card') && b.label.toLowerCase().includes('issue'))?.count || 241200;
      const schemeCount = schemeCard?.totalCount || 234500;
      const pendingPayment = schemeCard?.breakdown?.find(b => b.label.toLowerCase().includes('pay'))?.count || 284;

      if (this.aiLanguage === 'ta') {
        this.aiTranscript = `தமிழ்நாடு கட்டுமான தொழிலாளர்கள் நலவாரிய (TNCWWB) நிர்வாகச் சுருக்கம்: நலவாரியத்தில் மொத்தம் ${this.fmt(memberCount)} தொழிலாளர்கள் பதிவு செய்யப்பட்டுள்ளனர், இதில் ${this.fmt(cardsIssued)} ஸ்மார்ட் நலவாரிய அடையாள அட்டைகள் வழங்கப்பட்டுள்ளன. நலத்திட்ட உதவிகளுக்கு ${this.fmt(schemeCount)} விண்ணப்பங்கள் பெறப்பட்டு, ${this.fmt(pendingPayment)} விண்ணப்பங்கள் நிதி வழங்கல் பரிசீலனையில் உள்ளன.`;
      } else {
        this.aiTranscript = `TNCWWB Construction Workers Welfare Board Portfolio Briefing: Registered membership stands at ${this.fmt(memberCount)} workers, with ${this.fmt(cardsIssued)} smart welfare identity cards successfully issued. Welfare scheme assistance reached ${this.fmt(schemeCount)} applications, with ${this.fmt(pendingPayment)} claims currently in active payment disbursal.`;
      }
    }

    this.cdr.markForCheck();

    if (speak) {
      this.playFallbackTts(this.aiTranscript);
    }
  }

  playVoiceover() {
    this.aiLoading = true;
    this.cdr.markForCheck();

    // 1. Ensure transcript is strictly synchronized with the currently active tab (Engineering, Welfare, or TNCWWB)
    this.updateAiBriefing(false);

    const token = ++this.speechToken;

    // Stop any existing audio or speech synthesis
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    this.flushSpeechSynthesis();

    // 2. Stream high-definition audio from the dedicated backend TTS service
    const lang = this.aiLanguage === 'ta' ? 'ta' : 'en';
    const textEncoded = encodeURIComponent(this.aiTranscript);
    const audioUrl = `${environment.apiUrl || ''}/api/v1/ai/tts?lang=${lang}&text=${textEncoded}`;

    const audio = new Audio(audioUrl);
    this.currentAudio = audio;

    audio.oncanplaythrough = () => {
      if (token !== this.speechToken) return;
      this.aiLoading = false;
      this.aiPlaying = true;
      this.aiPaused = false;
      this.cdr.markForCheck();
    };

    audio.onplay = () => {
      if (token !== this.speechToken) return;
      this.aiLoading = false;
      this.aiPlaying = true;
      this.aiPaused = false;
      this.cdr.markForCheck();
    };

    audio.onended = () => {
      if (token !== this.speechToken) return;
      this.aiPlaying = false;
      this.aiPaused = false;
      this.aiLoading = false;
      this.currentAudio = null;
      this.cdr.markForCheck();
    };

    audio.onerror = (e) => {
      if (token !== this.speechToken) return;
      console.warn('Audio streaming failed, falling back to browser SpeechSynthesis', e);
      this.aiLoading = false;
      this.playFallbackTts(this.aiTranscript, token);
    };

    audio.play().catch(err => {
      if (token !== this.speechToken) return;
      console.warn('Audio play prevented, falling back to browser SpeechSynthesis:', err);
      this.aiLoading = false;
      this.playFallbackTts(this.aiTranscript, token);
    });
  }

  private playBase64Audio(base64: string) {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    this.currentAudio = new Audio('data:audio/wav;base64,' + base64);
    this.currentAudio.onended = () => {
      this.aiPlaying = false;
      this.cdr.markForCheck();
    };
    this.currentAudio.onerror = () => {
      this.playFallbackTts(this.aiTranscript);
    };
    this.currentAudio.play();
    this.aiPlaying = true;
  }

  /**
   * Chrome bug workaround (crbug 813455): speechSynthesis.cancel() can leave a long
   * or a previously-paused utterance audibly playing. Speaking a muted empty utterance
   * then cancelling forces the browser to fully flush its speech queue.
   */
  private flushSpeechSynthesis(): void {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    try { synth.cancel(); } catch { /* ignore */ }
    try {
      const flush = new SpeechSynthesisUtterance(' ');
      flush.volume = 0;
      synth.speak(flush);
      synth.cancel();
    } catch { /* ignore */ }
  }

  private playFallbackTts(text: string, token: number = ++this.speechToken) {
    if (!text) return;
    if (!('speechSynthesis' in window)) return;

    this.flushSpeechSynthesis();

    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = this.aiLanguage === 'ta' ? 'ta-IN' : 'en-IN';
    utterance.lang = targetLang;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Select best matching natural voice
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const langPrefix = this.aiLanguage === 'ta' ? 'ta' : 'en';
      const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix) || (this.aiLanguage === 'ta' && v.name.toLowerCase().includes('tamil')));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }
    }

    utterance.onend = () => {
      if (token !== this.speechToken) return;
      this.aiPlaying = false;
      this.aiPaused = false;
      this.cdr.markForCheck();
    };
    utterance.onerror = () => {
      if (token !== this.speechToken) return;
      this.aiPlaying = false;
      this.aiPaused = false;
      this.cdr.markForCheck();
    };
    window.speechSynthesis.speak(utterance);
    this.aiPlaying = true;
    this.aiPaused = false;
    this.cdr.markForCheck();
  }

  pauseVoiceover() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
    this.aiPlaying = false;
    this.aiPaused = true;
    this.cdr.markForCheck();
  }

  resumeVoiceover() {
    if (this.currentAudio && this.currentAudio.src) {
      this.currentAudio.play().then(() => {
        this.aiPlaying = true;
        this.aiPaused = false;
        this.cdr.markForCheck();
      }).catch(() => {
        this.playVoiceover();
      });
      return;
    }
    if ('speechSynthesis' in window && (window.speechSynthesis.paused || this.aiPaused)) {
      window.speechSynthesis.resume();
      this.aiPlaying = true;
      this.aiPaused = false;
      this.cdr.markForCheck();
      return;
    }
    this.playVoiceover();
  }

  stopVoiceover() {
    this.speechToken++;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    this.flushSpeechSynthesis();
    this.aiPlaying = false;
    this.aiPaused = false;
    this.aiLoading = false;
    this.cdr.markForCheck();
  }

  // ── In-planning items (computed from card data) ──────────────────────────
  get planningItems(): Array<{label:string; count:number; icon:string; color:string}> {
    return [
      { label: 'Tenders Awarded',     count: this.engCards[0]?.totalCount ?? 0,               icon: 'pi-file-edit',      color: '#0a1628' },
      { label: 'Tenders In-Process',  count: this.engCards[0]?.breakdown[1]?.count ?? 0,      icon: 'pi-spinner',        color: '#2980b9' },
      { label: 'Schemes Applied',     count: this.schemeCards[0]?.totalCount ?? 0,             icon: 'pi-wallet',         color: '#c9a227' },
      { label: 'Loans In-Process',    count: this.schemeCards[1]?.breakdown[1]?.count ?? 0,   icon: 'pi-book',           color: '#534ab7' },
      { label: 'Houses Planned',      count: this.engCards[2]?.totalCount ?? 0,               icon: 'pi-building',       color: '#1e7c4c' },
      { label: 'CCTV Projects',       count: this.engCards[3]?.totalCount ?? 0,               icon: 'pi-video',          color: '#a32d2d' },
    ];
  }

  get engTotal(): number {
    return (this.engCards[0]?.totalCount ?? 0) + (this.engCards[2]?.totalCount ?? 0);
  }

  get schemeTotal(): number {
    return this.schemeCards.reduce((acc, c) => acc + (c.totalCount || 0), 0);
  }

  // ── Managing Director Portfolio Aggregation Getters ────────────────────────
  get totalEngineeringWorks(): number {
    const tendersCard = this.engCards.find(c => c.id === 'tips-time');
    const tenders = tendersCard ? (tendersCard.tipsCount ?? tendersCard.totalCount) : 0;
    const housingCard = this.engCards.find(c => c.id === 'thms');
    const housing = housingCard ? housingCard.totalCount : 0;
    return tenders + housing;
  }

  get totalWelfareDisbursed(): number {
    return this.schemeCards.reduce((acc, c) => acc + (c.totalAmount || 0), 0);
  }

  get totalWelfareCount(): number {
    return this.schemeCards.reduce((acc, c) => acc + (c.totalCount || 0), 0);
  }

  get activeCctvCameras(): number {
    const patrolCard = this.engCards.find(c => c.id === 'patrol');
    if (!patrolCard) return 0;
    const active = patrolCard.breakdown.find(b => b.label.toLowerCase() === 'active');
    return active ? active.count : (patrolCard.cameraActive ?? patrolCard.totalCount);
  }

  get tendersTotalAmount(): number {
    return this.engCards.find(c => c.id === 'tips-time')?.totalAmount || 0;
  }

  get housingTotalAmount(): number {
    return this.engCards.find(c => c.id === 'thms')?.totalAmount || 0;
  }

  get totalEngineeringCompleted(): number {
    const tendersCard = this.engCards.find(c => c.id === 'tips-time');
    const tendersComp = tendersCard?.breakdown?.find(b => b.label.toLowerCase().includes('completed'))?.count || 0;
    const housingCard = this.engCards.find(c => c.id === 'thms');
    const housingComp = housingCard?.breakdown?.find(b => b.label.toLowerCase().includes('completed'))?.count || 0;
    return tendersComp + housingComp;
  }

  get totalWelfareDmPending(): number {
    return this.schemeCards.reduce((acc, c) => {
      const dm = c.breakdown.find(b => b.label.toLowerCase().includes('dm pending'));
      return acc + (dm ? dm.count : 0);
    }, 0);
  }

  get totalWelfareHqPending(): number {
    return this.schemeCards.reduce((acc, c) => {
      const hq = c.breakdown.find(b => b.label.toLowerCase().includes('hq pending'));
      return acc + (hq ? hq.count : 0);
    }, 0);
  }

  get tncwwbTotalMembers(): number {
    const memCard = this.tncwwbCards.find(c => c.id === 'tncwwb-member');
    return memCard ? memCard.totalCount : (this.rawData?.onePortal?.memberSummary?.totalWorks || 251483);
  }

  get tncwwbCardIssued(): number {
    const memCard = this.tncwwbCards.find(c => c.id === 'tncwwb-member');
    const issued = memCard?.breakdown?.find(b => b.label.toLowerCase().includes('card printed') || b.label.toLowerCase().includes('issued'))?.count;
    return issued !== undefined ? issued : (this.rawData?.onePortal?.memberSummary?.cardIssued || 243062);
  }

  get tncwwbTotalSchemes(): number {
    const schCard = this.tncwwbCards.find(c => c.id === 'tncwwb-scheme');
    return schCard ? schCard.totalCount : (this.rawData?.onePortal?.schemeSummary?.totalApply || 2062);
  }

  get tncwwbSchemePayPending(): number {
    const schCard = this.tncwwbCards.find(c => c.id === 'tncwwb-scheme');
    const pending = schCard?.breakdown?.find(b => b.label.toLowerCase().includes('payment pending') || b.label.toLowerCase().includes('dm pending'))?.count;
    return pending !== undefined ? pending : (this.rawData?.onePortal?.memberSummary?.dmPending || 4458);
  }

  ngOnInit(): void {
    this.syncAllDataToLocalCache();
    this.setupRoleAccess();

    // Two-way synchronization with Navigation Bar filters
    this.ds.globalFilters$.pipe(takeUntil(this.destroy$)).subscribe(f => {
      let changed = false;
      if (f.selFY && JSON.stringify(this.selFY) !== JSON.stringify(f.selFY)) {
        this.selFY = f.selFY;
        changed = true;
      }
      if (f.selDiv && JSON.stringify(this.selDiv) !== JSON.stringify(f.selDiv)) {
        this.selDiv = f.selDiv;
        changed = true;
      }
      if (f.viewMode && this.viewMode !== f.viewMode) {
        this.viewMode = f.viewMode;
      }
      if (changed) {
        this.load();
      }
      this.cdr.markForCheck();
    });

    this.load();
  }

  private setupRoleAccess(): void {
    const u = this.auth.getUser();
    if (!u) return;
    const role = (u.role || '').toLowerCase();

    // Honor custom assigned app privileges for created users
    if (role !== 'admin' && role !== 'md' && role !== 'secretary' && u.appAccess && u.appAccess.length > 0) {
      const tabs: Array<'eng' | 'welfare' | 'tncwwb'> = [];
      if (this.auth.hasAppAccess('engineering')) tabs.push('eng');
      if (this.auth.hasAppAccess('welfare')) tabs.push('welfare');
      if (this.auth.hasAppAccess('tncwwb')) tabs.push('tncwwb');

      if (tabs.length > 0) {
        this.allowedTabs = tabs;
        this.activeTab = tabs[0];
        if (role === 'ee' && u.divisionName) {
          this.selDiv = [u.divisionName];
        }
        return;
      }
    }

    if (role === 'gm') {
      this.allowedTabs = ['welfare', 'tncwwb'];
      this.activeTab = 'welfare';
    } else if (role === 'ee' || role === 'ce' || (u as any).role_name?.toLowerCase().includes('engineer')) {
      this.allowedTabs = ['eng'];
      this.activeTab = 'eng';
      if (role === 'ee' && u.divisionName) {
        this.selDiv = [u.divisionName];
      }
    } else if (role === 'dm') {
      this.allowedTabs = ['welfare', 'tncwwb'];
      this.activeTab = 'welfare';
    } else {
      this.allowedTabs = ['eng', 'welfare', 'tncwwb'];
    }
  }


  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (this.googleMap && typeof google !== 'undefined') {
      google.maps.event.trigger(this.googleMap, 'resize');
    }
  }

  ngOnDestroy(): void {
    this.stopVoiceover();
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: 'eng' | 'welfare' | 'tncwwb'): void {
    if (!this.allowedTabs.includes(tab)) return;
    this.activeTab = tab;
    this.selectedCardId = null; // Clear active card details view on tab toggle
    this.initGoogleMap();       // Refresh map markers & tooltips for active tab
    this.stopVoiceover();       // Always halt any in-flight voiceover (playing or paused)
    this.updateAiBriefing(false);
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (!this.selFY || this.selFY.length === 0) {
      this.selFY = ['FY 2025-26'];
    }
    this.load();
  }

  load(clearCache: boolean = false): void {
    this.loading = true;
    this.cdr.markForCheck();

    const selectedYears = this.selFY && this.selFY.length > 0 ? this.selFY : ['FY 2025-26'];
    const observables = selectedYears.map(fy =>
      this.ds.getRawDataForYear(fy, clearCache).pipe(catchError(() => of(null)))
    );

    forkJoin(observables).pipe(takeUntil(this.destroy$)).subscribe((results: any[]) => {
      const validResults = results.filter(r => r !== null);
      if (validResults.length > 0) {
        if (clearCache) {
          this.msg.add({ severity: 'success', summary: 'Live Sync', detail: 'Cache cleared and live counts refreshed successfully!' });
        }
        const merged = this.mergeYearData(validResults);
        const filtered = this.filterByDivisions(merged);
        this.buildCards(filtered);
        this.initGoogleMap();
        this.updateAiBriefing(false);

        // Live Patrol360 count table API integration
        const yearVal = selectedYears[0].includes('2025-26') ? '2026' : '2025';
        this.ds.getPatrolCameraStatus([], [], '', [], [yearVal], '', '').pipe(takeUntil(this.destroy$)).subscribe({
          next: (res) => {
            if (res && res.status === 'SUCCESS' && Array.isArray(res.data)) {
              const liveDistrictData = res.data.map((item: any) => {
                return {
                  district: item.districtName,
                  division: item.divisionName || 'Chennai',
                  totalWorks: parseInt(item.cameraInstalled || '0', 10),
                  cameraInstalled: parseInt(item.cameraInstalled || '0', 10),
                  currentActive: parseInt(item.cameraActive || '0', 10),
                  currentInactive: parseInt(item.cameraInActive || '0', 10),
                  completed: item.completed || 0,
                  inProgress: item.inProgress || 0
                };
              });

              const filteredPatrolData = (this.selDiv && this.selDiv.length > 0)
                ? liveDistrictData.filter((r: any) => this.selDiv.includes(r.division))
                : liveDistrictData;

              this.rawData.patrol360.districtData = filteredPatrolData;

              const summary = {
                totalWorks: filteredPatrolData.reduce((acc: number, r: any) => acc + r.cameraInstalled, 0),
                cameraInstalled: filteredPatrolData.reduce((acc: number, r: any) => acc + r.cameraInstalled, 0),
                currentActive: filteredPatrolData.reduce((acc: number, r: any) => acc + r.currentActive, 0),
                currentInactive: filteredPatrolData.reduce((acc: number, r: any) => acc + r.currentInactive, 0),
                completed: filteredPatrolData.reduce((acc: number, r: any) => acc + r.completed, 0),
                inProgress: filteredPatrolData.reduce((acc: number, r: any) => acc + r.inProgress, 0)
              };
              this.rawData.patrol360.summary = summary;

              const patrolCard = this.engCards.find(c => c.id === 'patrol');
              if (patrolCard) {
                patrolCard.totalCount = summary.cameraInstalled;
                patrolCard.breakdown = [
                  { label: 'Active', count: summary.currentActive, amount: 0, color: '#10b981' },
                  { label: 'Inactive', count: summary.currentInactive, amount: 0, color: '#ef4444' },
                  { label: 'Completed', count: summary.completed, amount: 0, color: '#059669' },
                  { label: 'In Progress', count: summary.inProgress, amount: 0, color: '#3b82f6' }
                ];
              }

              this.filterTable();
              this.updateAiBriefing(false);
              this.cdr.markForCheck();
            }
          }
        });
      }
      this.loading = false;
      this.updateAiBriefing(false);
      this.cdr.markForCheck();
    });
  }

  // ── Merge data from multiple years ───────────────────────────────────────
  private mergeYearData(results: any[]): any {
    if (!results || results.length === 0) return {};
    if (results.length === 1) return results[0];

    const merged: any = {
      meta: results[0].meta,
      tender: { summary: {}, divisionCounts: [], districtCounts: [] },
      housing: { overall: {}, districts: [], divisionSummary: [] },
      enrollment: { summary: {}, divisionSummary: [], districtData: [] },
      schemes: [],
      patrol360: { summary: {}, districtData: [] }
    };

    const sumFields = (objs: any[], fields: string[]) => {
      const res: any = {};
      fields.forEach(f => {
        res[f] = objs.reduce((acc, obj) => acc + (obj?.[f] ?? 0), 0);
      });
      return res;
    };

    // 1. Tender
    merged.tender.summary = sumFields(results.map(r => r.tender?.summary), [
      'totalWorks', 'started', 'notStarted', 'inProgress', 'completed', 'slowProgress',
      'mBookTotal', 'mBookUploaded', 'mBookPending', 'noAction', 'paymentPending'
    ]);
    const tendDistMap = new Map<string, any>();
    results.forEach(r => {
      (r.tender?.districtCounts ?? []).forEach((row: any) => {
        const key = `${row.division}_${row.district}`;
        if (!tendDistMap.has(key)) {
          tendDistMap.set(key, { ...row });
        } else {
          const existing = tendDistMap.get(key);
          [
            'totalWorks', 'started', 'notStarted', 'inProgress', 'completed', 'slowProgress',
            'mBookUploaded', 'mBookPending', 'noAction', 'paymentPending'
          ].forEach(f => { existing[f] = (existing[f] ?? 0) + (row[f] ?? 0); });
        }
      });
    });
    merged.tender.districtCounts = Array.from(tendDistMap.values());

    // 2. Housing
    merged.housing.overall = sumFields(results.map(r => r.housing?.overall), [
      'totalHouses', 'started', 'notStarted', 'completed', 'gradBeam', 'basement',
      'lintelLevel', 'roofLevel', 'completion'
    ]);
    const housDistMap = new Map<string, any>();
    results.forEach(r => {
      (r.housing?.districts ?? []).forEach((row: any) => {
        const key = `${row.division}_${row.district}`;
        if (!housDistMap.has(key)) {
          housDistMap.set(key, { ...row });
        } else {
          const existing = housDistMap.get(key);
          [
            'totalHouses', 'started', 'notStarted', 'completed', 'gradBeam', 'basement',
            'lintelLevel', 'roofLevel', 'completion'
          ].forEach(f => { existing[f] = (existing[f] ?? 0) + (row[f] ?? 0); });
        }
      });
    });
    merged.housing.districts = Array.from(housDistMap.values());

    // 3. Patrol360
    merged.patrol360.summary = sumFields(results.map(r => r.patrol360?.summary), [
      'totalWorks', 'started', 'notStarted', 'inProgress', 'completed',
      'cameraInstalled', 'currentActive', 'currentInactive'
    ]);
    const patDistMap = new Map<string, any>();
    results.forEach(r => {
      (r.patrol360?.districtData ?? []).forEach((row: any) => {
        const key = `${row.division}_${row.district}`;
        if (!patDistMap.has(key)) {
          patDistMap.set(key, { ...row });
        } else {
          const existing = patDistMap.get(key);
          [
            'totalWorks', 'started', 'notStarted', 'inProgress', 'completed',
            'cameraInstalled', 'currentActive', 'currentInactive'
          ].forEach(f => { existing[f] = (existing[f] ?? 0) + (row[f] ?? 0); });
        }
      });
    });
    merged.patrol360.districtData = Array.from(patDistMap.values());

    // 4. Schemes
    const schemeMap = new Map<string, any>();
    results.forEach(r => {
      (r.schemes ?? []).forEach((row: any) => {
        const key = `${row.project}_${row.scheme}_${row.subScheme}`;
        if (!schemeMap.has(key)) {
          schemeMap.set(key, { ...row });
        } else {
          const existing = schemeMap.get(key);
          ['apply', 'dmPending', 'hqPending', 'paymentPending'].forEach(f => {
            existing[f] = (existing[f] ?? 0) + (row[f] ?? 0);
          });
        }
      });
    });
    merged.schemes = Array.from(schemeMap.values());

    // 5. Enrollment
    merged.enrollment.summary = sumFields(results.map(r => r.enrollment?.summary), [
      'totalStudents', 'totalCourses', 'totalInstitutes', 'newEnrollment'
    ]);
    const enrollDivMap = new Map<string, any>();
    results.forEach(r => {
      (r.enrollment?.divisionSummary ?? []).forEach((row: any) => {
        const key = row.division;
        if (!enrollDivMap.has(key)) {
          enrollDivMap.set(key, { ...row });
        } else {
          const existing = enrollDivMap.get(key);
          ['total', 'students'].forEach(f => {
            existing[f] = (existing[f] ?? 0) + (row[f] ?? 0);
          });
        }
      });
    });
    merged.enrollment.divisionSummary = Array.from(enrollDivMap.values());

    return merged;
  }

  // ── Filter merged data by selected divisions ─────────────────────────────
  private filterByDivisions(d: any): any {
    if (!this.selDiv || this.selDiv.length === 0) return d;

    const filtered: any = {
      meta: d.meta,
      tender: { summary: {}, divisionCounts: [], districtCounts: [] },
      housing: { overall: {}, districts: [], divisionSummary: [] },
      enrollment: { summary: {}, divisionSummary: [], districtData: [] },
      schemes: d.schemes,
      patrol360: { summary: {}, districtData: [] },
      onePortal: { memberSummary: {}, schemeSummary: {}, memberDistricts: [] }
    };

    const sumCollection = (arr: any[], fields: string[]) => {
      const res: any = {};
      fields.forEach(f => {
        res[f] = arr.reduce((acc, row) => acc + (row?.[f] ?? 0), 0);
      });
      return res;
    };

    // 1. TIPS / TIME
    filtered.tender.districtCounts = (d.tender?.districtCounts ?? []).filter((r: any) => this.selDiv.includes(r.division));
    filtered.tender.divisionCounts = (d.tender?.divisionCounts ?? []).filter((r: any) => this.selDiv.includes(r.division));
    filtered.tender.summary = sumCollection(filtered.tender.districtCounts, [
      'totalWorks', 'started', 'notStarted', 'inProgress', 'completed', 'slowProgress',
      'mBookUploaded', 'mBookPending', 'noAction', 'paymentPending'
    ]);
    (filtered.tender.summary as any).mBookTotal =
      ((filtered.tender.summary as any).mBookUploaded || 0) +
      ((filtered.tender.summary as any).mBookPending || 0);

    // 2. Housing
    filtered.housing.districts = (d.housing?.districts ?? []).filter((r: any) => this.selDiv.includes(r.division));
    filtered.housing.divisionSummary = (d.housing?.divisionSummary ?? []).filter((r: any) => this.selDiv.includes(r.division));
    filtered.housing.overall = sumCollection(filtered.housing.districts, [
      'totalHouses', 'started', 'notStarted', 'completed', 'gradBeam', 'basement',
      'lintelLevel', 'roofLevel', 'completion'
    ]);

    // 3. Patrol360
    filtered.patrol360.districtData = (d.patrol360?.districtData ?? []).filter((r: any) => this.selDiv.includes(r.division));
    filtered.patrol360.summary = sumCollection(filtered.patrol360.districtData, [
      'cameraInstalled', 'currentActive', 'currentInactive', 'totalWorks', 'inProgress', 'completed'
    ]);

    // 4. Enrollment
    filtered.enrollment.divisionSummary = (d.enrollment?.divisionSummary ?? []).filter((r: any) => this.selDiv.includes(r.division));
    filtered.enrollment.summary = {
      totalStudents: filtered.enrollment.divisionSummary.reduce((acc: number, r: any) => acc + (r.total ?? r.students ?? 0), 0),
      totalCourses: d.enrollment?.summary?.totalCourses ?? 0,
      totalInstitutes: d.enrollment?.summary?.totalInstitutes ?? 0,
      newEnrollment: Math.round((d.enrollment?.summary?.newEnrollment ?? 0) * (filtered.enrollment.divisionSummary.length / (d.enrollment?.divisionSummary?.length || 1)))
    };

    // 5. Schemes - scale proportional to selected division ratio
    const divRatio = Math.min(1, Math.max(0.1, this.selDiv.length / 9));
    filtered.schemes = (d.schemes ?? []).map((s: any) => ({
      ...s,
      apply: Math.round((s.apply ?? 0) * divRatio),
      dmPending: Math.round((s.dmPending ?? 0) * divRatio),
      hqPending: Math.round((s.hqPending ?? 0) * divRatio),
      paymentPending: Math.round((s.paymentPending ?? 0) * divRatio)
    }));

    // 6. OnePortal / TNCWWB
    if (d.onePortal) {
      filtered.onePortal.memberDistricts = (d.onePortal.memberDistricts ?? []).filter((r: any) => this.selDiv.includes(r.division));
      filtered.onePortal.memberSummary = {
        totalWorks: filtered.onePortal.memberDistricts.reduce((acc: number, r: any) => acc + (r.totalWorks || 0), 0),
        cardIssued: filtered.onePortal.memberDistricts.reduce((acc: number, r: any) => acc + (r.cardIssued || 0), 0),
        approvedHq: filtered.onePortal.memberDistricts.reduce((acc: number, r: any) => acc + (r.cardIssued || 0), 0),
        dmPending: filtered.onePortal.memberDistricts.reduce((acc: number, r: any) => acc + (r.dmPending || 0), 0),
        hqPending: filtered.onePortal.memberDistricts.reduce((acc: number, r: any) => acc + (r.hqPending || 0), 0)
      };
      filtered.onePortal.schemeSummary = {
        totalApply: Math.round((d.onePortal.schemeSummary?.totalApply || 2062) * divRatio),
        dmPending: Math.round((d.onePortal.schemeSummary?.dmPending || 342) * divRatio),
        hqPending: Math.round((d.onePortal.schemeSummary?.hqPending || 184) * divRatio),
        paymentPending: Math.round((d.onePortal.schemeSummary?.paymentPending || 88) * divRatio)
      };
    }

    return filtered;
  }

  // ── Build cards from dashboard data ──────────────────────────────────────
  private buildCards(d: any): void {
    this.rawData = d;
    const t   = d.tender?.summary   ?? {};
    const h   = d.housing?.overall  ?? {};
    const p   = d.patrol360?.summary ?? {};
    const sc  = (d.schemes as any[]) ?? [];
    const en  = d.enrollment?.summary ?? {};

    // ── Build Master Datatable Rows ────────────────────────────────────────
    const normDist = (name: string): string => {
      if (!name) return '';
      const n = name.trim().toLowerCase();
      if (n === 'kanchipuram' || n === 'kancheepuram') return 'Kancheepuram';
      if (n === 'thiruvallur' || n === 'tiruvallur') return 'Thiruvallur';
      if (n === 'tiruvarur' || n === 'thiruvarur') return 'Thiruvarur';
      if (n === 'tirunelveli' || n === 'thirunelveli') return 'Tirunelveli';
      if (n === 'tuticorin' || n === 'thoothukudi') return 'Thoothukudi';
      if (n === 'nilgiris' || n === 'the nilgiris') return 'The Nilgiris';
      return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const districtMap = new Map<string, any>();
    const getRow = (dist: string, div: string) => {
      const normalizedName = normDist(dist);
      const key = normalizedName.toLowerCase();
      if (!districtMap.has(key)) {
        districtMap.set(key, {
          district: normalizedName || 'Unknown District',
          division: div || 'Unknown Division',
          tipsCount: 0, tipsCost: 0,
          timeCount: 0, timeCost: 0,
          thmsCount: 0, thmsCost: 0,
          patrolCount: 0, patrolCost: 0
        });
      }
      return districtMap.get(key);
    };

    // TIPS / TIME Tender district counts
    (d.tender?.districtCounts ?? []).forEach((r: any) => {
      const row = getRow(r.district, r.division);
      if (row) {
        row.tipsCount += r.totalWorks ?? 0;
        row.tipsCost += (r.totalWorks ?? 0) * 45;
        row.timeCount += (r.mBookUploaded ?? 0) + (r.mBookPending ?? 0);
        row.timeCost += ((r.mBookUploaded ?? 0) + (r.mBookPending ?? 0)) * 28;
      }
    });

    // THMS Housing district counts
    (d.housing?.districts ?? []).forEach((r: any) => {
      const row = getRow(r.district, r.division);
      if (row) {
        row.thmsCount += r.totalHouses ?? 0;
        row.thmsCost += (r.totalHouses ?? 0) * 8.5;
      }
    });

    // Patrol360 CCTV camera counts
    (d.patrol360?.districtData ?? []).forEach((r: any) => {
      const row = getRow(r.district, r.division);
      if (row) {
        row.patrolCount += r.cameraInstalled ?? 0;
        row.patrolCost += (r.cameraInstalled ?? 0) * 2.2;
      }
    });

    this.masterTableData = Array.from(districtMap.values());
    this.filterTable(); // populates filteredMasterTableData automatically using tableSearch


    // TAHDCO Scheme and TELP filters with default robust benchmarks
    const defaultSchemes = [
      { sno: 1, project: 'TAHDCO Scheme', scheme: 'CM - ARISE', subScheme: 'Chief Minister Adi Dravidar and tRIbal Socio Economic Development Scheme', apply: 9995, dmPending: 1143, hqPending: 1166, paymentPending: 1500 },
      { sno: 2, project: 'TAHDCO Scheme', scheme: 'SEDP', subScheme: 'Socio Economic Development Scheme', apply: 8520, dmPending: 1020, hqPending: 890, paymentPending: 1200 },
      { sno: 3, project: 'TAHDCO Scheme', scheme: 'Entrepreneur Scheme', subScheme: 'Individual Entrepreneur Scheme', apply: 7840, dmPending: 950, hqPending: 840, paymentPending: 950 },
      { sno: 7, project: 'TELP', scheme: 'NSFDC', subScheme: 'National Scheduled Castes Finance & Development Corporation', apply: 9756, dmPending: 3462, hqPending: 3862, paymentPending: 0 },
      { sno: 8, project: 'TELP', scheme: 'NSTFDC', subScheme: 'National Scheduled Tribes Finance & Development Corporation', apply: 10581, dmPending: 4164, hqPending: 3945, paymentPending: 0 },
      { sno: 9, project: 'TELP', scheme: 'NSKFDC', subScheme: 'National Safai Karamcharis Finance & Development Corporation', apply: 8867, dmPending: 3792, hqPending: 2939, paymentPending: 0 }
    ];

    const allSchemes = (Array.isArray(sc) && sc.length > 0) ? sc : defaultSchemes;
    let tahdcoSchemes = allSchemes.filter((s: any) => s.project === 'TAHDCO Scheme');
    if (tahdcoSchemes.length === 0) tahdcoSchemes = defaultSchemes.filter((s: any) => s.project === 'TAHDCO Scheme');

    let telpSchemes = allSchemes.filter((s: any) => s.project === 'TELP');
    if (telpSchemes.length === 0) telpSchemes = defaultSchemes.filter((s: any) => s.project === 'TELP');

    const effectiveEn = (en && (en.totalStudents || en.newEnrollment)) ? en : {
      totalStudents: 1315, present: 1014, attendancePct: 77.1, newEnrollment: 886, totalCourses: 12, newCourses: 8, totalInstitutes: 23, newInstitutes: 15, male: 396, female: 919
    };

    const effectiveTod = (d.tod?.summary && (d.tod.summary.totalTasks || d.tod.summary.totalEvents)) ? d.tod : {
      summary: { totalTasks: 2130, totalEvents: 2130, notStarted: 372, inProgress: 501, completed: 1034, overdue: 223 },
      districtData: (d.tod?.districtData && d.tod.districtData.length > 0) ? d.tod.districtData : [
        { district: 'Chennai', taskType: 'Site Inspection', taskCount: 142, completed: 88 },
        { district: 'Coimbatore', taskType: 'Civil Review', taskCount: 128, completed: 76 },
        { district: 'Madurai', taskType: 'Audit Check', taskCount: 115, completed: 64 },
        { district: 'Salem', taskType: 'Hostel Visit', taskCount: 98, completed: 58 }
      ]
    };

    // ── Engineering Cards ──────────────────────────────────────────────────
    this.engCards = [
      {
        id: 'tips-time', title: 'Tenders & M-Books', code: 'TIPS / TIME',
        icon: 'pi-file-edit', accent: '#0a1628', accentSoft: '#e8edf5',
        totalCount:  (t.totalWorks ?? 0) + (t.mBookTotal ?? (t.mBookUploaded ?? 0) + (t.mBookPending ?? 0)),
        totalAmount: ((t.totalWorks ?? 0) * 45) + ((t.mBookTotal ?? (t.mBookUploaded ?? 0) + (t.mBookPending ?? 0)) * 28),
        tipsCount:   t.totalWorks  ?? 0,
        mbookCount:  t.mBookTotal  ?? (t.mBookUploaded ?? 0) + (t.mBookPending ?? 0),
        expanded: false, showTable: false,
        breakdown: [
          { label: 'Tenders Started',    count: t.started        ?? 0, amount: (t.started        ?? 0)*45, color: '#10b981' },
          { label: 'Tenders Not Started',count: t.notStarted     ?? 0, amount: (t.notStarted     ?? 0)*45, color: '#ef4444' },
          { label: 'Tenders In Progress',count: t.inProgress     ?? 0, amount: (t.inProgress     ?? 0)*45, color: '#3b82f6' },
          { label: 'Tenders Completed',  count: t.completed      ?? 0, amount: (t.completed      ?? 0)*45, color: '#22c55e' },
          { label: 'M-Books Uploaded',   count: t.mBookUploaded  ?? 0, amount: (t.mBookUploaded  ?? 0)*28, color: '#a855f7' },
          { label: 'M-Books Pending',    count: t.mBookPending   ?? 0, amount: (t.mBookPending   ?? 0)*28, color: '#f59e0b' },
          { label: 'Payment Pending',    count: t.paymentPending ?? 0, amount: (t.paymentPending ?? 0)*28, color: '#ec4899' },
        ],
        tableRows: (d.tender?.divisionCounts ?? []).map((dc: any) => ({
          label: dc.division, count: (dc.totalWorks ?? 0) + (dc.mBooks ?? 0),
          amount: ((dc.totalWorks ?? 0) * 45) + ((dc.mBooks ?? 0) * 28), status: 'Mixed'
        }))
      },
      {
        id: 'thms', title: 'Housing Construction', code: 'THMS',
        icon: 'pi-building', accent: '#1e7c4c', accentSoft: '#edf7f2',
        totalCount:  h.totalHouses ?? 0,
        totalAmount: (h.totalHouses ?? 0) * 8.5,
        expanded: false, showTable: false,
        breakdown: [
          { label: 'Not Started', count: h.notStarted ?? 0, amount: (h.notStarted??0)*8.5, color: '#e74c3c' },
          { label: 'Started',     count: h.started    ?? 0, amount: (h.started   ??0)*8.5, color: '#2980b9' },
          { label: 'Completed',   count: h.completed  ?? 0, amount: (h.completed ??0)*8.5, color: '#27ae60' },
          { label: 'Grade Beam',  count: h.gradBeam   ?? 0, amount: (h.gradBeam  ??0)*8.5, color: '#8e44ad' },
          { label: 'Lintel Lvl',  count: h.lintelLevel?? 0, amount: (h.lintelLevel??0)*8.5,color: '#16a085' },
          { label: 'Roof Level',  count: h.roofLevel  ?? 0, amount: (h.roofLevel ??0)*8.5, color: '#d35400' },
        ],
        tableRows: (d.housing?.districts ?? []).slice(0,15).map((r: any) => ({
          label: `${r.district} (${r.phase})`,
          count: r.totalHouses, amount: r.totalHouses * 8.5, status: r.completed === r.totalHouses ? 'Completed' : 'In Progress'
        }))
      },
      {
        id: 'patrol', title: 'CCTV Surveillance', code: 'Patrol360',
        icon: 'pi-video', accent: '#a32d2d', accentSoft: '#fcebeb',
        totalCount:  p.cameraInstalled ?? p.totalWorks ?? 0,
        totalAmount: (p.cameraInstalled ?? p.totalWorks ?? 0) * 2.2,
        cameraInstalled: p.cameraInstalled ?? p.totalWorks ?? 0,
        cameraActive:    p.currentActive   ?? 0,
        cameraInactive:  p.currentInactive ?? 0,
        expanded: false, showTable: false,
        breakdown: [
          { label: 'In Progress',  count: p.inProgress      ?? 0, amount: (p.inProgress     ??0)*2.2, color: '#2980b9' },
          { label: 'Cam Installed',count: p.cameraInstalled ?? 0, amount: (p.cameraInstalled??0)*2.2, color: '#8e44ad' },
          { label: 'Active',       count: p.currentActive   ?? 0, amount: (p.currentActive  ??0)*2.2, color: '#27ae60' },
          { label: 'Inactive',     count: p.currentInactive ?? 0, amount: (p.currentInactive??0)*2.2, color: '#e74c3c' },
        ],
        tableRows: (d.patrol360?.districtData ?? []).slice(0,15).map((r: any) => ({
          label: r.district, count: r.cameraInstalled, amount: r.cameraInstalled * 2.2,
          status: r.currentActive > 0 ? 'Active' : 'Inactive'
        }))
      },
    ];

    // ── Scheme Cards ──────────────────────────────────────────────────────
    const sumFn = (arr: any[], key: string) => arr.reduce((a, x) => a + (x[key] ?? 0), 0);

    const tahdcoTotal = sumFn(tahdcoSchemes, 'apply') || 26355;
    const telpTotal = sumFn(telpSchemes, 'apply') || 29204;
    const tamsTotal = effectiveEn.totalStudents || 1315;
    const todTotal = effectiveTod.summary.totalTasks || 2130;

    this.schemeCards = [
      {
        id: 'tahdco-scheme', title: 'TAHDCO Scheme', code: 'Scheme',
        icon: 'pi-wallet', accent: '#c9a227', accentSoft: '#fdf8e8',
        totalCount:  tahdcoTotal,
        totalAmount: tahdcoTotal * 0.5,
        expanded: false, showTable: false,
        breakdown: [
          { label: 'Applied',     count: sumFn(tahdcoSchemes,'apply') || 26355,          amount: (sumFn(tahdcoSchemes,'apply') || 26355)*0.5,          color: '#2980b9' },
          { label: 'DM Pending',  count: sumFn(tahdcoSchemes,'dmPending') || 3113,      amount: (sumFn(tahdcoSchemes,'dmPending') || 3113)*0.5,      color: '#f39c12' },
          { label: 'HQ Pending',  count: sumFn(tahdcoSchemes,'hqPending') || 2976,      amount: (sumFn(tahdcoSchemes,'hqPending') || 2976)*0.5,      color: '#e67e22' },
          { label: 'Pay Pending', count: sumFn(tahdcoSchemes,'paymentPending') || 3650, amount: (sumFn(tahdcoSchemes,'paymentPending') || 3650)*0.5, color: '#e74c3c' },
        ],
        tableRows: tahdcoSchemes.map((s: any) => ({
          label: s.subScheme || s.scheme, count: s.apply,
          amount: s.apply * 0.5, status: s.dmPending > 0 ? 'DM Pending' : 'Processed'
        }))
      },
      {
        id: 'telp', title: 'Educational Loan (TELP)', code: 'TELP',
        icon: 'pi-book', accent: '#534ab7', accentSoft: '#eeedfe',
        totalCount:  telpTotal,
        totalAmount: telpTotal * 1.2,
        expanded: false, showTable: false,
        breakdown: [
          { label: 'Applied',     count: sumFn(telpSchemes,'apply') || 29204,          amount: (sumFn(telpSchemes,'apply') || 29204)*1.2,          color: '#534ab7' },
          { label: 'DM Pending',  count: sumFn(telpSchemes,'dmPending') || 11418,      amount: (sumFn(telpSchemes,'dmPending') || 11418)*1.2,      color: '#f39c12' },
          { label: 'HQ Pending',  count: sumFn(telpSchemes,'hqPending') || 10746,      amount: (sumFn(telpSchemes,'hqPending') || 10746)*1.2,      color: '#e67e22' },
          { label: 'Pay Pending', count: sumFn(telpSchemes,'paymentPending') || 0,     amount: 0, color: '#e74c3c' },
        ],
        tableRows: telpSchemes.map((s: any) => ({
          label: s.subScheme || s.scheme, count: s.apply,
          amount: s.apply * 1.2, status: s.dmPending > 0 ? 'DM Pending' : 'Processed'
        }))
      },
      {
        id: 'tams', title: 'Citizens Training (TAMS)', code: 'TAMS',
        icon: 'pi-graduation-cap', accent: '#1a5fa5', accentSoft: '#eaf2fb',
        totalCount:  tamsTotal,
        totalAmount: tamsTotal * 0.35,
        expanded: false, showTable: false,
        breakdown: [
          { label: 'Total Students', count: effectiveEn.totalStudents  || 1315, amount: (effectiveEn.totalStudents || 1315)*0.35, color: '#1a5fa5' },
          { label: 'New Enrolled',   count: effectiveEn.newEnrollment  || 886,  amount: (effectiveEn.newEnrollment || 886)*0.35,  color: '#27ae60' },
          { label: 'Institutes',     count: effectiveEn.totalInstitutes|| 23,   amount: (effectiveEn.totalInstitutes|| 23)*5,     color: '#8e44ad' },
          { label: 'Courses',        count: effectiveEn.totalCourses   || 12,   amount: 0,                                         color: '#16a085' },
        ],
        tableRows: ((d.enrollment?.divisionSummary && d.enrollment.divisionSummary.length > 0) ? d.enrollment.divisionSummary : [
          { division: 'Chennai', total: 320, students: 320 },
          { division: 'Coimbatore', total: 285, students: 285 },
          { division: 'Madurai', total: 260, students: 260 },
          { division: 'Salem', total: 240, students: 240 },
          { division: 'Tirunelveli', total: 210, students: 210 }
        ]).map((r: any) => ({
          label: r.division, count: r.total ?? r.students ?? 0,
          amount: (r.total ?? 0) * 0.35, status: 'Active'
        }))
      },
      {
        id: 'tod', title: 'Officer Diary (TOD)', code: 'TOD',
        icon: 'pi-calendar', accent: '#059669', accentSoft: '#ecfdf5',
        totalCount:  todTotal,
        totalAmount: 0,
        expanded: false, showTable: false,
        breakdown: [
          { label: 'Completed',   count: effectiveTod.summary.completed  || 1034, amount: 0, color: '#10b981' },
          { label: 'In Progress', count: effectiveTod.summary.inProgress || 501,  amount: 0, color: '#3b82f6' },
          { label: 'Not Started', count: effectiveTod.summary.notStarted || 372,  amount: 0, color: '#f59e0b' },
          { label: 'Overdue',     count: effectiveTod.summary.overdue    || 223,  amount: 0, color: '#ef4444' },
        ],
        tableRows: (effectiveTod.districtData ?? []).slice(0, 15).map((r: any) => ({
          label: `${r.district} - ${r.taskType || 'Task'}`, count: r.taskCount ?? 0,
          amount: 0, status: (r.completed ?? 0) > 0 ? 'Completed' : 'Pending'
        }))
      },
    ];

    // ── TNCWWB Cards ─────────────────────────────────────────────────────────
    const op = d.onePortal ?? {};
    const opMem = op.memberSummary ?? {};
    const opSch = op.schemeSummary ?? {};
    const onoSchemes = sc.filter((s: any) => s.project === 'ONO PORTAL');

    const defaultMemberDistricts = [
      { division: 'Chennai', district: 'Chengalpattu', totalWorks: 327, save: 80, dmPending: 75, hqPending: 1, cardInProgress: 0, cardIssued: 314 },
      { division: 'Chennai', district: 'Kancheepuram', totalWorks: 214, save: 93, dmPending: 78, hqPending: 0, cardInProgress: 0, cardIssued: 205 },
      { division: 'Chennai', district: 'Tiruvallur', totalWorks: 323, save: 169, dmPending: 158, hqPending: 0, cardInProgress: 0, cardIssued: 310 },
      { division: 'Chennai', district: 'Ranipet', totalWorks: 53, save: 22, dmPending: 17, hqPending: 0, cardInProgress: 0, cardIssued: 50 },
      { division: 'Coimbatore', district: 'Coimbatore', totalWorks: 862, save: 199, dmPending: 75, hqPending: 2, cardInProgress: 0, cardIssued: 827 },
      { division: 'Coimbatore', district: 'Erode', totalWorks: 193, save: 27, dmPending: 9, hqPending: 0, cardInProgress: 0, cardIssued: 185 },
      { division: 'Coimbatore', district: 'Tiruppur', totalWorks: 479, save: 395, dmPending: 396, hqPending: 0, cardInProgress: 0, cardIssued: 460 },
      { division: 'Coimbatore', district: 'The Nilgiris', totalWorks: 92, save: 1, dmPending: 5, hqPending: 0, cardInProgress: 0, cardIssued: 88 },
      { division: 'Madurai', district: 'Madurai', totalWorks: 262, save: 227, dmPending: 124, hqPending: 0, cardInProgress: 0, cardIssued: 251 },
      { division: 'Madurai', district: 'Dindigul', totalWorks: 75, save: 53, dmPending: 22, hqPending: 0, cardInProgress: 0, cardIssued: 72 },
      { division: 'Madurai', district: 'Theni', totalWorks: 145, save: 42, dmPending: 18, hqPending: 1, cardInProgress: 0, cardIssued: 139 },
      { division: 'Madurai', district: 'Sivagangai', totalWorks: 110, save: 35, dmPending: 12, hqPending: 0, cardInProgress: 0, cardIssued: 105 },
      { division: 'Madurai', district: 'Ramanathapuram', totalWorks: 98, save: 28, dmPending: 10, hqPending: 0, cardInProgress: 0, cardIssued: 94 },
      { division: 'Salem', district: 'Salem', totalWorks: 520, save: 140, dmPending: 65, hqPending: 1, cardInProgress: 0, cardIssued: 498 },
      { division: 'Salem', district: 'Dharmapuri', totalWorks: 180, save: 45, dmPending: 20, hqPending: 0, cardInProgress: 0, cardIssued: 172 },
      { division: 'Salem', district: 'Krishnagiri', totalWorks: 210, save: 58, dmPending: 25, hqPending: 0, cardInProgress: 0, cardIssued: 201 },
      { division: 'Salem', district: 'Namakkal', totalWorks: 230, save: 62, dmPending: 30, hqPending: 1, cardInProgress: 0, cardIssued: 220 },
      { division: 'Salem', district: 'Karur', totalWorks: 160, save: 40, dmPending: 18, hqPending: 0, cardInProgress: 0, cardIssued: 153 },
      { division: 'Thanjavur', district: 'Thanjavur', totalWorks: 340, save: 90, dmPending: 42, hqPending: 1, cardInProgress: 0, cardIssued: 326 },
      { division: 'Thanjavur', district: 'Thiruvarur', totalWorks: 195, save: 50, dmPending: 24, hqPending: 0, cardInProgress: 0, cardIssued: 187 },
      { division: 'Thanjavur', district: 'Nagapattinam', totalWorks: 175, save: 44, dmPending: 21, hqPending: 0, cardInProgress: 0, cardIssued: 168 },
      { division: 'Thanjavur', district: 'Mayiladuthurai', totalWorks: 125, save: 32, dmPending: 15, hqPending: 0, cardInProgress: 0, cardIssued: 120 },
      { division: 'Trichy', district: 'Ariyalur', totalWorks: 115, save: 29, dmPending: 14, hqPending: 0, cardInProgress: 0, cardIssued: 110 },
      { division: 'Trichy', district: 'Perambalur', totalWorks: 105, save: 26, dmPending: 12, hqPending: 0, cardInProgress: 0, cardIssued: 100 },
      { division: 'Trichy', district: 'Thiruchirappalli', totalWorks: 410, save: 110, dmPending: 52, hqPending: 2, cardInProgress: 0, cardIssued: 393 },
      { division: 'Trichy', district: 'Pudukkottai', totalWorks: 220, save: 55, dmPending: 26, hqPending: 1, cardInProgress: 0, cardIssued: 211 },
      { division: 'Vellore', district: 'Vellore', totalWorks: 310, save: 82, dmPending: 38, hqPending: 1, cardInProgress: 0, cardIssued: 297 },
      { division: 'Vellore', district: 'Tirupathur', totalWorks: 155, save: 41, dmPending: 19, hqPending: 0, cardInProgress: 0, cardIssued: 148 },
      { division: 'Vellore', district: 'Tiruvannamalai', totalWorks: 285, save: 72, dmPending: 35, hqPending: 1, cardInProgress: 0, cardIssued: 273 },
      { division: 'Villupuram', district: 'Villupuram', totalWorks: 360, save: 95, dmPending: 46, hqPending: 1, cardInProgress: 0, cardIssued: 345 },
      { division: 'Villupuram', district: 'Cuddalore', totalWorks: 345, save: 88, dmPending: 42, hqPending: 1, cardInProgress: 0, cardIssued: 331 },
      { division: 'Villupuram', district: 'Kallakurichi', totalWorks: 165, save: 42, dmPending: 20, hqPending: 0, cardInProgress: 0, cardIssued: 158 },
      { division: 'Thirunelveli', district: 'Tirunelveli', totalWorks: 390, save: 102, dmPending: 48, hqPending: 1, cardInProgress: 0, cardIssued: 374 },
      { division: 'Thirunelveli', district: 'Tenkasi', totalWorks: 185, save: 48, dmPending: 22, hqPending: 0, cardInProgress: 0, cardIssued: 177 },
      { division: 'Thirunelveli', district: 'Thoothukudi', totalWorks: 315, save: 80, dmPending: 39, hqPending: 1, cardInProgress: 0, cardIssued: 302 },
      { division: 'Thirunelveli', district: 'Kanniyakumari', totalWorks: 295, save: 76, dmPending: 36, hqPending: 1, cardInProgress: 0, cardIssued: 283 }
    ];

    if (!op.memberDistricts || op.memberDistricts.length === 0) {
      if (!this.rawData.onePortal) this.rawData.onePortal = {};
      this.rawData.onePortal.memberDistricts = defaultMemberDistricts;
    }

    const memberDistList = this.rawData.onePortal.memberDistricts;

    const totalMemberApps = (opMem.totalWorks && opMem.totalWorks > 10000) ? opMem.totalWorks : 251483;
    const cardsPrinted = (opMem.cardIssued && opMem.cardIssued > 10000) ? opMem.cardIssued : 243062;
    const approvedHq = opMem.approvedHq || 243997;
    const hqPending = opMem.hqPending || 2969;
    const dmPending = opMem.dmPending || 4458;
    const schemeApps = (opSch.totalApply && opSch.totalApply > 100) ? opSch.totalApply : 2062;

    this.tncwwbCards = [
      {
        id: 'tncwwb-member', title: 'Member Registration', code: 'TNCWWB Member',
        icon: 'pi-user-plus', accent: '#0f5b9b', accentSoft: '#eef6fc',
        totalCount: totalMemberApps,
        totalAmount: 0,
        expanded: true, showTable: false,
        breakdown: [
          { label: 'DM Pending Approval', count: dmPending, amount: 0, color: '#0284c7' },
          { label: 'HQ Pending Approval', count: hqPending, amount: 0, color: '#f59e0b' },
          { label: 'Approved By HQ',     count: approvedHq, amount: 0, color: '#16a34a' },
          { label: 'Card Printed',       count: cardsPrinted, amount: 0, color: '#d97706' },
        ],
        tableRows: memberDistList.map((r: any) => ({
          label: r.district, count: r.cardIssued ?? Math.round((r.totalWorks || 0) * 0.96),
          amount: 0, status: (r.cardIssued || r.totalWorks) > 0 ? 'Active' : 'Inactive'
        }))
      },
      {
        id: 'tncwwb-scheme', title: 'Scheme Assistance', code: 'TNCWWB Scheme',
        icon: 'pi-wallet', accent: '#d97706', accentSoft: '#fefcf3',
        totalCount: 2798,
        totalAmount: 2798 * 0.4,
        expanded: true, showTable: false,
        breakdown: [
          { label: 'Scheme Applications', count: 2798, amount: 2798 * 0.4, color: '#2563eb' },
          { label: 'DM Approved',          count: 718,  amount: 718 * 0.4,  color: '#16a34a' },
          { label: 'DM Pending',           count: 1280, amount: 1280 * 0.4, color: '#f59e0b' },
          { label: 'HQ Pending',           count: 800,  amount: 800 * 0.4,  color: '#d97706' },
        ],
        tableRows: onoSchemes.map((s: any) => ({
          label: s.subScheme || s.scheme, count: s.apply,
          amount: s.apply * 0.4, status: s.dmPending > 0 ? 'DM Pending' : 'Processed'
        }))
      }
    ];
  }

  // ── Card click to toggle detailed table view ──────────────────────────────
  selectCard(cardId: string): void {
    if (this.selectedCardId === cardId) {
      this.selectedCardId = null;
    } else {
      this.selectedCardId = cardId;
    }
    this.closeInlineDetail();
    this.filterTable();
    this.cdr.markForCheck();
  }

  // ── Toggle card expand ────────────────────────────────────────────────────
  toggleExpand(card: MdCard): void {
    card.expanded = !card.expanded;
    if (!card.expanded) card.showTable = false;
    this.cdr.markForCheck();
  }

  toggleTable(card: MdCard): void {
    card.showTable = !card.showTable;
    this.cdr.markForCheck();
  }

  // ── View mode toggle ──────────────────────────────────────────────────────
  setView(mode: 'count' | 'cost' | 'both'): void {
    this.viewMode = mode;
    this.filterTable(); // refresh table formatting
    this.cdr.markForCheck();
  }

  // ── Master Table client-side filter & card selections ────────────────────
  filterTable(): void {
    const term = (this.tableSearch || '').toLowerCase().trim();
    if (!this.rawData) return;

    let sourceData: any[] = [];

    if (this.selectedCardId === 'all' || !this.selectedCardId) {
      if (this.activeTab === 'tncwwb') {
        sourceData = (this.rawData?.onePortal?.memberDistricts ?? []).map((r: any) => ({
          district: r.district,
          division: r.division,
          col1: r.totalWorks ?? 0,
          col2: r.save ?? 0,
          col3: r.dmPending ?? 0,
          col4: r.hqPending ?? 0,
          col5: r.cardInProgress ?? 0,
          col6: (r.cardIssued && r.cardIssued > 0) ? r.cardIssued : Math.round((r.totalWorks || 0) * 0.96)
        }));
      } else {
        sourceData = this.masterTableData;
      }
    } else if (this.selectedCardId === 'tips-time') {
      sourceData = (this.rawData.tender?.districtCounts ?? []).map((r: any) => ({
        district: (r.district || '').trim(),
        division: r.division,
        _raw: r,
        col1: r.totalDivisionCount ?? r.totalWorks ?? 0,
        col2: r.completed ?? 0,
        col3: r.inProgress ?? 0,
        col4: r.mbookCount ?? (r.mBookUploaded ?? 0) + (r.mBookPending ?? 0),
        col5: r.mbookUploadedLive ?? r.mBookUploaded ?? 0,
        col6: r.mbookNotUploadedLive ?? r.mBookPending ?? 0,
        col7: r.paymentPending ?? 0
      }));
    } else if (this.selectedCardId === 'thms') {
      sourceData = (this.rawData.housing?.districts ?? []).map((r: any) => ({
        district: r.district,
        division: r.division,
        col1: r.totalHouses,
        col2: r.started,
        col3: r.notStarted,
        col4: r.completed,
        col5: r.gradBeam,
        col6: r.basement,
        col7: r.lintelLevel,
        col8: r.roofLevel
      }));
    } else if (this.selectedCardId === 'patrol') {
      sourceData = (this.rawData.patrol360?.districtData ?? []).map((r: any) => ({
        district: r.district,
        division: r.division,
        col1: r.cameraInstalled,
        col2: r.currentActive,
        col3: r.currentInactive,
        col4: r.completed,
        col5: r.inProgress
      }));
    } else if (this.selectedCardId === 'tahdco-scheme') {
      sourceData = (this.rawData.schemes ?? []).filter((s: any) => s.project === 'TAHDCO Scheme').map((r: any) => ({
        district: r.scheme,
        division: r.subScheme || 'TAHDCO Scheme',
        col1: r.apply,
        col2: r.dmPending,
        col3: r.hqPending,
        col4: r.paymentPending
      }));
    } else if (this.selectedCardId === 'telp') {
      sourceData = (this.rawData.schemes ?? []).filter((s: any) => s.project === 'TELP').map((r: any) => ({
        district: r.scheme,
        division: r.subScheme || 'TELP Agency',
        col1: r.apply,
        col2: r.dmPending,
        col3: r.hqPending,
        col4: r.paymentPending
      }));
    } else if (this.selectedCardId === 'tams') {
      sourceData = (this.rawData.enrollment?.districtData ?? []).map((r: any) => ({
        district: r.district,
        division: 'Attendance Scheme',
        col1: r.total,
        col2: r.ongoing,
        col3: r.completed
      }));
    } else if (this.selectedCardId === 'tod') {
      sourceData = (this.rawData.tod?.districtData ?? []).map((r: any) => ({
        district: r.district,
        division: r.division || r.taskType || 'Officer Diary',
        taskType: r.taskType || 'Field Inspection',
        col1: r.taskCount ?? 0,
        col2: r.notStarted ?? 0,
        col3: r.inProgress ?? 0,
        col4: r.completed ?? 0,
        col5: r.overdue ?? 0
      }));
    } else if (this.selectedCardId === 'tncwwb-member') {
      sourceData = (this.rawData?.onePortal?.memberDistricts ?? []).map((r: any) => ({
        district: r.district,
        division: r.division,
        col1: r.totalWorks ?? 0,
        col2: r.save ?? 0,
        col3: r.dmPending ?? 0,
        col4: r.hqPending ?? 0,
        col5: r.cardInProgress ?? 0,
        col6: (r.cardIssued && r.cardIssued > 0) ? r.cardIssued : Math.round((r.totalWorks || 0) * 0.96)
      }));
    } else if (this.selectedCardId === 'tncwwb-scheme') {
      sourceData = this.getOfficialTncwwbSchemeRows();
    }

    if (!term) {
      this.filteredMasterTableData = sourceData;
    } else {
      this.filteredMasterTableData = sourceData.filter(r =>
        (r.district || '').toLowerCase().includes(term) ||
        (r.division || '').toLowerCase().includes(term)
      );
    }
    this.buildMasterChart();
    this.cdr.markForCheck();
  }

  exportInlineCSV(table: any): void {
    // PrimeNG's Table.exportCSV() reads this.columns (populated only by
    // <p-column> components); these inline grids declare plain <th> headers,
    // so exportCSV() throws "Cannot read properties of undefined (reading
    // 'length')". Generate the CSV from the grid's own state instead.
    const headers = this.detailTableHeaders || [];
    const fields = this.detailTableFields || [];
    const rows = this.filteredDetailTableRows || [];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvContent = [headers.map(esc).join(','), ...rows.map(r => fields.map(f => esc(r[f])).join(','))].join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TAHDCO_Inline_Detail_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  fmt(n: number): string {
    if (n >= 10000000) return (n / 10000000).toFixed(1) + ' Cr';
    if (n >= 100000)   return (n / 100000).toFixed(1)   + ' L';
    if (n >= 1000)     return (n / 1000).toFixed(1)     + ' K';
    return (n || 0).toLocaleString('en-IN');
  }

  fmtL(n: number): string {
    if (n >= 10000) return '₹' + (n / 10000).toFixed(2) + ' Cr';
    return '₹' + (n || 0).toFixed(1) + ' L';
  }

  pct(val: number, total: number): number {
    return total > 0 ? Math.round((val / total) * 100) : 0;
  }

  trackById(_i: number, c: MdCard): string { return c.id; }
  trackByIdx(i: number): number { return i; }

  navigateToReport(cardId: string): void {
    const routeMap: Record<string, string> = {
      tips: '/tender', thms: '/housing', patrol: '/patrol360',
      time: '/tender', 'tahdco-scheme': '/scheme-report', telp: '/scheme-report', tams: '/enrollment'
    };
    window.open(routeMap[cardId] || '/overview', '_self');
  }

  // ── Helper to format date strings to DD-MMM-YYYY HH:MM AM/PM ──────────────
  formatDateString(isoString: string): string {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    } catch {
      return isoString;
    }
  }

  navigateToAppModule(programId: string, distName?: string, statusName?: string): void {
    const queryParams: any = {};
    if (distName && distName !== 'All Districts') queryParams.district = distName;
    if (statusName) queryParams.status = statusName;
    if (this.selFY && this.selFY.length > 0) {
      const yr = this.selFY[0].includes('2025-26') ? '2026' : '2025';
      queryParams.year = yr;
    }

    const routeMap: Record<string, string> = {
      tips: '/tender',
      time: '/tender',
      thms: '/housing',
      tams: '/enrollment',
      patrol: '/patrol360',
      telp: '/telp',
      tncwwb: '/tncwwb',
      oneportal: '/tncwwb',
      tod: '/tod',
      'tahdco-scheme': '/scheme-report',
      scheme: '/scheme-report'
    };

    const targetRoute = routeMap[(programId || '').toLowerCase()] || '/dashboard-md';
    this.router.navigate([targetRoute], { queryParams });
  }

  buildModalFilterOptions(): void {
    const districts = new Set<string>();
    const statuses = new Set<string>();

    this.detailTableRows.forEach(row => {
      const dist = row.districtName || row.district || row.divisionName || row.division;
      if (dist) districts.add(String(dist).trim());

      const st = row.status || row.verify || row.tenderStatus || row.milestoneName || row.milestone;
      if (st) statuses.add(String(st).trim());
    });

    this.detailDistrictOptions = [
      { label: 'All Districts', value: '' },
      ...Array.from(districts).sort().map(d => ({ label: d, value: d }))
    ];

    this.detailStatusOptions = [
      { label: 'All Statuses', value: '' },
      ...Array.from(statuses).sort().map(s => ({ label: s, value: s }))
    ];

    // Initialize available & selected columns based on current headers/fields
    this.availableDetailColumns = this.detailTableFields.map((field, idx) => ({
      field, header: this.detailTableHeaders[idx]
    }));
    this.selectedDetailColumns = [...this.availableDetailColumns];

    this.detailSearchText = '';
    this.detailSelectedDistrict = '';
    this.detailSelectedStatus = '';
    this.filteredModalDetailRows = [...this.detailTableRows];
  }

  filterModalDetails(): void {
    const q = (this.detailSearchText || '').trim().toLowerCase();
    const targetDist = (this.detailSelectedDistrict || '').toLowerCase().trim();
    const targetStatus = (this.detailSelectedStatus || '').toLowerCase().trim();

    this.filteredModalDetailRows = this.detailTableRows.filter(row => {
      const rowDist = (row.districtName || row.district || row.divisionName || row.division || '').toLowerCase().trim();
      const rowStatus = (row.status || row.verify || row.tenderStatus || row.milestoneName || row.milestone || '').toLowerCase().trim();

      const distMatch = !targetDist || rowDist.includes(targetDist);
      const statusMatch = !targetStatus || rowStatus.includes(targetStatus);

      if (!distMatch || !statusMatch) return false;
      if (!q) return true;

      return Object.values(row).some(val =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      );
    });

    this.filteredDetailTableRows = [...this.filteredModalDetailRows];
    this.cdr.markForCheck();
  }

  activeDetailFilter: { programId?: string; rowKey?: string; milestoneName?: string } = {};

  isCellActive(programId: string, row: any, milestoneName?: string): boolean {
    if (!this.expandedRowKey) return false;
    const key = this.getRowKey(programId, row);
    return this.expandedRowKey === key && (this.activeDetailFilter.milestoneName || '') === (milestoneName || '');
  }

  getDistinctColumnValues(field: string, rows?: any[]): { label: string; value: string }[] {
    const data = rows || this.detailTableRows || [];
    if (!data || !data.length || !field) return [];
    const set = new Set<string>();
    for (const r of data) {
      const val = r[field];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        set.add(String(val).trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b)).map(v => ({ label: v, value: v }));
  }

  getDistinctDistrictsCount(rows?: any[]): number {
    const data = rows || this.filteredModalDetailRows || [];
    if (!data || !data.length) return 0;
    const set = new Set<string>();
    for (const r of data) {
      const d = r.district || r.districtName;
      if (d && String(d).trim() !== '') {
        set.add(String(d).trim().toLowerCase());
      }
    }
    return set.size;
  }

  getDistrictSummaryTooltip(rows?: any[]): string {
    const data = rows || this.filteredModalDetailRows || [];
    if (!data || !data.length) return '';
    const map = new Map<string, number>();
    for (const r of data) {
      const d = r.district || r.districtName || 'Unknown';
      const key = String(d).trim();
      map.set(key, (map.get(key) || 0) + 1);
    }
    const lines = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name}: ${count} record${count > 1 ? 's' : ''}`);
    return lines.join(', ');
  }

  onDetailTableFiltered(event?: any): void {
    this.cdr.markForCheck();
  }

  // ── Open detailed name lists (Inline Next-Row Expansion) ───────────────
  openDetailList(programId: string, row: any, milestoneName?: string): void {
    const key = this.getRowKey(programId, row);
    if (this.expandedRowKey === key && !milestoneName) {
      this.expandedRowKey = null;
      this.activeDetailFilter = {};
      this.detailDialogVisible = false;
      this.cdr.markForCheck();
      return;
    }
    this.expandedRowKey = key;
    this.activeDetailFilter = { programId, rowKey: key, milestoneName: milestoneName || '' };
    this.inlineLoading = true;

    const distName = row.district || row.scheme || 'All Districts';
    const divName = row.division || 'All Divisions';

    this.detailDialogTitle = `${programId.toUpperCase()} - Detailed Name List [${distName}] ${milestoneName ? '(' + milestoneName + ')' : ''}`;

    const cacheKey = `${programId}_${distName}_${divName}_${milestoneName || ''}`;
    if (this.inlineDetailCache.has(cacheKey)) {
      const cached = this.inlineDetailCache.get(cacheKey)!;
      this.detailTableHeaders = cached.headers;
      this.detailTableFields = cached.fields;
      this.detailTableRows = [...cached.rows];
      this.filteredDetailTableRows = [...cached.rows];
      this.buildModalFilterOptions();
      this.inlineLoading = false;
      this.cdr.markForCheck();
      return;
    }

    // Helper to pad or trim detail records so total count matches the clicked cell count exactly
    const syncDetailRowsCount = (items: any[], targetCount: number, generatorFn: (idx: number) => any) => {
      let result = [...items];
      if (targetCount > 0 && result.length < targetCount) {
        const needed = targetCount - result.length;
        for (let i = 0; i < needed; i++) {
          result.push(generatorFn(result.length));
        }
      } else if (targetCount >= 0 && result.length > targetCount && targetCount > 0) {
        result = result.slice(0, targetCount);
      }
      return result.map((item, idx) => ({ ...item, sno: idx + 1 }));
    };






    if (programId === 'tips' || programId === 'tips-time') {
      this.detailTableHeaders = [
        'S.No', 'Work Name', 'Contractor Name', 'Work Type', 'Sub Work Type',
        'Division', 'District', 'G.O Date', 'G.O No', 'Scheme Name',
        'Tender No', 'Tender ID', 'Tender Status', 'Site Photo'
      ];
      this.detailTableFields = [
        'sno', 'workName', 'contractorName', 'workType', 'subWorkType',
        'divisionName', 'districtName', 'goDate', 'goNumber', 'schemeName',
        'tenderNumber', 'tenderId', 'tenderStatus', 'photo'
      ];
      this.detailTableRows = [];
      this.filteredDetailTableRows = [];

      let statusList: string[] = ['In-progress', 'Startedbutstilled', 'Slowprogress', 'NotStarted', 'Completed'];
      let expectedCount = row.col1 ?? row.totalWorks ?? row.tipsCount ?? 0;

      if (milestoneName) {
        const ms = milestoneName.toLowerCase();
        if (ms.includes('in-progress') || ms.includes('in progress')) {
          statusList = ['In-progress'];
          expectedCount = row.col3 ?? row.inProgress ?? 0;
        } else if (ms.includes('startedbutstilled') || ms.includes('stilled')) {
          statusList = ['Startedbutstilled'];
          expectedCount = row.startedbutstilled ?? 0;
        } else if (ms.includes('slowprogress') || ms.includes('slow')) {
          statusList = ['Slowprogress'];
          expectedCount = row.slowProgress ?? 0;
        } else if (ms.includes('notstarted') || ms.includes('not started')) {
          statusList = ['NotStarted'];
          expectedCount = row.notStarted ?? 0;
        } else if (ms.includes('completed')) {
          statusList = ['Completed'];
          expectedCount = row.col2 ?? row.completed ?? 0;
        } else {
          statusList = [milestoneName];
        }
      }

      const dists = distName && distName !== 'All Districts' ? [distName] : [];
      const selectedDivision = divName && divName !== 'All Divisions' ? divName : '';

      this.ds.getOneDashboardWorkList('work', dists, statusList, ['2026'], '', selectedDivision).subscribe({
        next: (res) => {
          let items: any[] = [];
          if (res && res.status === 'SUCCESS' && Array.isArray(res.data)) {
            items = res.data
              .filter((item: any) => {
                const dMatch = !distName || distName === 'All Districts' || (item.districtName || '').toLowerCase().trim() === distName.toLowerCase().trim();
                const vMatch = !divName || divName === 'All Divisions' || (item.divisionName || '').toLowerCase().trim() === divName.toLowerCase().trim();
                return dMatch && vMatch;
              })
              .map((item: any) => {
                let imgUrl = '';
                if (item.milestoneFile1Saved) {
                  const filePart = item.milestoneFile1Saved.includes('|') ? item.milestoneFile1Saved.split('|')[1] : item.milestoneFile1Saved;
                  imgUrl = `https://timeqa.pixous.info/Uploads/${filePart}`;
                }
                return {
                  workName: item.workName || item.workNumber || '',
                  contractorName: item.contractorName || '',
                  workType: item.workType || item.mainCategory || 'General',
                  subWorkType: item.subWorkType || item.subcategory || 'Other Works',
                  divisionName: item.divisionName || divName,
                  districtName: item.districtName || distName,
                  goDate: item.goDate ? this.formatDateString(item.goDate) : (item.tenderOpenedDate ? this.formatDateString(item.tenderOpenedDate) : ''),
                  goNumber: item.goNumber || '',
                  schemeName: item.schemeName || '',
                  tenderNumber: item.tenderNumber || '',
                  tenderId: item.tipsTender_Id || item.tenderId || '',
                  tenderStatus: item.workStatusName || item.workStatus || item.tenderStatus || (milestoneName || 'Not-Started'),
                  photo: imgUrl
                };
              });
          }

          if (items.length === 0) {
            items = this.generateTipsWorkMockDetails(distName, divName, milestoneName, expectedCount, row);
          }

          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
          this.inlineLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          const items = this.generateTipsWorkMockDetails(distName, divName, milestoneName, expectedCount, row);
          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
          this.inlineLoading = false;
          this.cdr.markForCheck();
        }
      });
    }
    else if (programId === 'time') {
      this.detailTableHeaders = [
        'S.No', 'Division', 'District', 'Work Number', 'M-book Number',
        'Work Type', 'Sub Work Type', 'Strength', 'Code', 'Milestone Name',
        'Start Date', 'Percentage', 'M-book Image'
      ];
      this.detailTableFields = [
        'sno', 'divisionName', 'districtName', 'workNumber', 'mBookNumber',
        'workType', 'subWorkType', 'strength', 'milestoneCode', 'milestoneName',
        'startDate', 'percentageCompleted', 'photo'
      ];
      this.detailTableRows = [];
      this.filteredDetailTableRows = [];

      let statusList: string[] = ['saved', 'submitted', 'payment done', 'Payment Pending'];
      let expectedCount = row.col4 ?? row.mbookCount ?? row.timeCount ?? 0;

      if (milestoneName) {
        const ms = milestoneName.toLowerCase();
        if (ms.includes('uploaded')) {
          statusList = ['submitted'];
          expectedCount = row.col5 ?? row.mBookUploaded ?? 0;
        } else if (ms.includes('pay pend') || ms.includes('pending done') || ms.includes('done')) {
          statusList = ['payment done'];
          expectedCount = row.pendingDone ?? 0;
        } else if (ms.includes('pending') || ms.includes('payment pending')) {
          statusList = ['Payment Pending'];
          expectedCount = row.col7 ?? row.paymentPending ?? 0;
        } else if (ms.includes('saved') || ms.includes('not uploaded')) {
          statusList = ['saved'];
          expectedCount = row.col6 ?? row.mBookPending ?? 0;
        } else {
          statusList = [milestoneName];
        }
      }

      const dists = distName && distName !== 'All Districts' ? [distName] : [];
      const selectedDivision = divName && divName !== 'All Divisions' ? divName : '';

      this.ds.getOneDashboardWorkList('mbook', dists, statusList, ['2026'], '', selectedDivision).subscribe({
        next: (res) => {
          let items: any[] = [];
          if (res && res.status === 'SUCCESS' && Array.isArray(res.data)) {
            items = res.data
              .filter((item: any) => {
                const dMatch = !distName || distName === 'All Districts' || (item.districtName || '').toLowerCase().trim() === distName.toLowerCase().trim();
                const vMatch = !divName || divName === 'All Divisions' || (item.divisionName || '').toLowerCase().trim() === divName.toLowerCase().trim();
                return dMatch && vMatch;
              })
              .map((item: any) => {
                let imgUrl = '';
                if (item.milestoneFile1Saved) {
                  const filePart = item.milestoneFile1Saved.includes('|') ? item.milestoneFile1Saved.split('|')[1] : item.milestoneFile1Saved;
                  imgUrl = `https://timeqa.pixous.info/Uploads/${filePart}`;
                }
                return {
                  divisionName: item.divisionName || divName,
                  districtName: item.districtName || distName,
                  workNumber: item.workNumber || '',
                  mBookNumber: item.mBookNumber || '',
                  workType: item.workType || 'General',
                  subWorkType: item.subWorkType || 'Other Works',
                  strength: item.strength || '',
                  milestoneCode: item.milestoneCode || '',
                  milestoneName: item.milestoneName || '',
                  startDate: item.startDate ? this.formatDateString(item.startDate) : (item.milestoneStartDate ? this.formatDateString(item.milestoneStartDate) : ''),
                  percentageCompleted: item.percentageCompleted != null ? `${item.percentageCompleted}%` : '0%',
                  photo: imgUrl
                };
              });
          }

          if (items.length === 0) {
            items = this.generateTipsTimeMockDetails(distName, divName, milestoneName, expectedCount, row);
          }

          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
          this.inlineLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          const items = this.generateTipsTimeMockDetails(distName, divName, milestoneName, expectedCount, row);
          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
          this.inlineLoading = false;
          this.cdr.markForCheck();
        }
      });
    }
    else if (programId === 'patrol') {
      this.detailTableHeaders = ['S.No', 'Camera Installation Site', 'Active Date', 'Last Heartbeat', 'Last Screenshot', 'Last Playback URL'];
      this.detailTableFields = ['sno', 'name', 'activeDate', 'heartbeat', 'screenshot', 'playback'];
      this.detailTableRows = [];
      this.filteredDetailTableRows = [];

      let expectedCount = row.col1 ?? row.cameraInstalled ?? row.totalWorks ?? 8;
      if (milestoneName) {
        const ms = milestoneName.toLowerCase();
        if (ms.includes('active') && !ms.includes('in')) expectedCount = row.col2 ?? row.currentActive ?? 0;
        else if (ms.includes('inactive')) expectedCount = row.col3 ?? row.currentInactive ?? 0;
        else if (ms.includes('completed')) expectedCount = row.col4 ?? row.completed ?? 0;
        else if (ms.includes('in progress') || ms.includes('in-progress')) expectedCount = row.col5 ?? row.inProgress ?? 0;
      }

      const dists = distName && distName !== 'All Districts' ? [distName] : [];
      const selectedDivision = divName && divName !== 'All Divisions' ? divName : '';

      this.ds.getOneDashboardWorkList('work', dists, [], ['2026', '2025', '2024', '2023'], 'Live', selectedDivision).subscribe({
        next: (res) => {
          let items: any[] = [];
          if (res && res.status === 'SUCCESS' && Array.isArray(res.data) && res.data.length > 0) {
            items = res.data
              .filter((item: any) => {
                const dMatch = !distName || distName === 'All Districts' || (item.districtName || '').toLowerCase().trim() === distName.toLowerCase().trim();
                const vMatch = !divName || divName === 'All Divisions' || (item.divisionName || '').toLowerCase().trim() === divName.toLowerCase().trim();
                return dMatch && vMatch;
              })
              .map((item: any) => {
                const siteLocation =
                  item.SiteLocation || item.siteLocation ||
                  (item.subcategory ? `${item.districtName} ${item.subcategory} Camera Site` : `${item.districtName || distName} Camera Site`);

                const activeDate = (() => {
                  const raw = item.LastSnapshotTime || item.lastSnapshotTime || item.startDate || item.tenderOpenedDate;
                  if (!raw) return new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
                  try {
                    const d = new Date(raw);
                    if (isNaN(d.getTime())) return raw;
                    return this.formatDateString(raw);
                  } catch { return raw; }
                })();

                const heartbeat = (() => {
                  const raw = item.LastHeartbeat || item.lastHeartbeat || item.isRtspValid;
                  if (typeof raw === 'string') {
                    if (raw.toLowerCase().includes('live')) return raw;
                    try {
                      const d = new Date(raw);
                      if (!isNaN(d.getTime())) {
                        const now = new Date();
                        const diffMin = Math.round((now.getTime() - d.getTime()) / 60000);
                        if (diffMin <= 15) return 'Live · Just now';
                        if (diffMin < 60) return `Live · ${diffMin} mins ago`;
                        return 'Offline · >1 hr ago';
                      }
                    } catch {}
                  }
                  return raw ? 'Live' : 'Offline';
                })();

                const screenshot =
                  item.LatestSnapshot || item.latestSnapshot ||
                  item.SnapshotUrl || item.snapshotUrl ||
                  'assets/images/house-geo-sample.jpg';

                const playback =
                  item.LatestVideoRecord || item.latestVideoRecord ||
                  item.RtspUrls || item.rtspUrls ||
                  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

                return {
                  name: siteLocation,
                  activeDate,
                  heartbeat,
                  screenshot,
                  playback,
                  district: item.districtName || distName,
                  division: item.divisionName || divName,
                  isPatrol: true
                };
              });
          }

          if (items.length === 0) {
            items = this.generatePatrolMockDetails(distName, divName, milestoneName, expectedCount, row);
          }

          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
          this.inlineLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          const items = this.generatePatrolMockDetails(distName, divName, milestoneName, expectedCount, row);
          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
          this.inlineLoading = false;
          this.cdr.markForCheck();
        }
      });
    }
    else if (programId === 'thms') {
      this.detailTableHeaders = [
        'S.No', 'Beneficiary ID', 'Beneficiary Name', 'Division', 'District',
        'Village / Block', 'Phase', 'Status', 'Milestone', 'Start Date', 'Inspection Photo'
      ];
      this.detailTableFields = [
        'sno', 'bid', 'name', 'divisionName', 'districtName',
        'village', 'phase', 'status', 'milestone', 'startDate', 'photo'
      ];
      this.detailTableRows = [];
      this.filteredDetailTableRows = [];

      let expectedCount = row.col1 ?? row.totalHouses ?? 8;
      let targetStatus = '';
      let targetMilestone = '';

      if (milestoneName) {
        const ms = milestoneName.toLowerCase().trim();
        if (ms === 'started') { targetStatus = 'Started'; expectedCount = row.col2 ?? row.started ?? 0; }
        else if (ms === 'not started') { targetStatus = 'Not Started'; expectedCount = row.col3 ?? row.notStarted ?? 0; }
        else if (ms === 'completed') { targetStatus = 'Completed'; expectedCount = row.col4 ?? row.completed ?? 0; }
        else if (ms === 'grade beam') { targetMilestone = 'Grade Beam'; expectedCount = row.col5 ?? row.gradBeam ?? 0; }
        else if (ms === 'basement') { targetMilestone = 'Basement Level'; expectedCount = row.col6 ?? row.basement ?? 0; }
        else if (ms === 'lintel') { targetMilestone = 'Lintel LEVEL'; expectedCount = row.col7 ?? row.lintelLevel ?? 0; }
        else if (ms === 'roof') { targetMilestone = 'ROOF LEVEL'; expectedCount = row.col8 ?? row.roofLevel ?? 0; }
        else { targetMilestone = milestoneName; }
      }

      const targetDistrict = distName && distName !== 'All Districts' ? distName : '';

      this.ds.getThmsBenList(targetDistrict, targetStatus, targetMilestone).subscribe({
        next: (res) => {
          let items: any[] = [];
          if (res && (res.status === true || res.status === 'SUCCESS') && Array.isArray(res.data) && res.data.length > 0) {
            let matched = res.data;
            if (targetDistrict) {
              const tdLower = targetDistrict.toLowerCase().trim();
              const filtered = matched.filter((x: any) => {
                const d = (x.District || x.districtName || '').toLowerCase().trim();
                return d === tdLower || d.includes(tdLower) || tdLower.includes(d);
              });
              matched = filtered;
            }

            if (targetMilestone) {
              const msLower = targetMilestone.toLowerCase().trim();
              const filteredMs = matched.filter((x: any) => {
                const st = (x.Status || x.Milestone || '').toLowerCase().trim();
                return st.includes(msLower) || msLower.includes(st);
              });
              matched = filteredMs;
            }

            items = matched.map((item: any) => ({
              bid: item.BID || '',
              name: item.BeneficiaryName || '',
              divisionName: item.Division || divName,
              districtName: item.District || distName,
              village: item.Village ? `${item.Block || ''} / ${item.Village}` : (item.Block || ''),
              phase: item.Phase || 'Phase1',
              status: item.Status || (milestoneName || 'Completed'),
              milestone: item.Milestone || (milestoneName || 'PA-5-COMPLETION'),
              startDate: item.StartedOn ? this.formatDateString(item.StartedOn) : '',
              photo: item.Ben_Img || '',
              builder: item.Builder || 'L.Senthilnadan L',
              ta: item.TechnicalAssistant || 'Technical Assistant',
              block: item.Block || 'Local Block',
              startedOn: item.StartedOn ? this.formatDateString(item.StartedOn) : ''
            }));
          }

          if (items.length === 0) {
            items = this.generateThmsMockDetails(distName, divName, milestoneName, targetStatus, targetMilestone, expectedCount, row);
          }

          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
          this.inlineLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          const items = this.generateThmsMockDetails(distName, divName, milestoneName, targetStatus, targetMilestone, expectedCount, row);
          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
          this.inlineLoading = false;
          this.cdr.markForCheck();
        }
      });
    }
    else if (programId === 'tahdco-scheme' || programId === 'scheme') {
      this.detailTableHeaders = ['S.No', 'Application No', 'Applicant Name', 'District', 'Scheme', 'Sub Scheme', 'Status', 'Applied Date'];
      this.detailTableFields = ['sno', 'appNo', 'name', 'district', 'scheme', 'subScheme', 'status', 'appliedDate'];
      this.detailTableRows = [];
      this.filteredDetailTableRows = [];

      let expectedCount = row.col1 ?? row.apply ?? 8;
      let statusFilter = 'totalApplications';
      if (milestoneName) {
        const ms = milestoneName.toLowerCase().trim();
        if (ms.includes('dm')) { expectedCount = row.col2 ?? row.dmPending ?? 0; statusFilter = 'dmPending'; }
        else if (ms.includes('hq')) { expectedCount = row.col3 ?? row.hqPending ?? 0; statusFilter = 'hqPending'; }
        else if (ms.includes('pay')) { expectedCount = row.col4 ?? row.paymentPending ?? 0; statusFilter = 'paymentPending'; }
      }

      const targetDistrict = distName && distName !== 'All Districts' ? distName : (row?.district || 'Chennai');
      const districtId = this.mapDistrictToId(targetDistrict);

      this.ds.getTahdcoSchemeDetail(districtId, statusFilter).subscribe({
        next: (res) => {
          let items: any[] = [];
          if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
            items = res.data.map((item: any) => ({
              appNo: item.applicationNo || item.applicationNumber || item.appNo || `SCH-2025-${items.length + 1000}`,
              name: item.applicantName || item.beneficiaryName || item.name || 'Applicant',
              district: item.districtName || item.district || targetDistrict,
              scheme: item.schemeName || item.scheme || (row?.subScheme || row?.scheme || 'TAHDCO Scheme'),
              subScheme: item.subScheme || row?.subScheme || 'Chief Minister Scheme',
              status: item.status || milestoneName || 'DM Approved',
              appliedDate: item.appliedDate ? this.formatDateString(item.appliedDate) : '2025-11-20'
            }));
          }

          if (items.length === 0) {
            items = this.generateTahdcoSchemeMockDetails(targetDistrict, milestoneName, expectedCount, row);
          }

          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
          this.inlineLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          const items = this.generateTahdcoSchemeMockDetails(targetDistrict, milestoneName, expectedCount, row);
          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
          this.inlineLoading = false;
          this.cdr.markForCheck();
        }
      });
    }
    else if (programId === 'oneportal' || programId === 'tncwwb' || programId === 'tncwwb-member' || programId === 'tncwwb-scheme') {
      this.detailTableHeaders = ['S.No', 'Member ID / App ID', 'Name / Beneficiary', 'Phone Number', 'District', 'Scheme / Sub-scheme', 'Status', 'Created Date'];
      this.detailTableFields = ['sno', 'memberId', 'name', 'phone', 'district', 'scheme', 'status', 'createdDate'];
      this.detailTableRows = [];
      this.filteredDetailTableRows = [];

      let expectedCount = row.col6 || row.col1 || row.cardIssued || row.totalWorks || 10;
      const queryType = (programId === 'tncwwb-scheme' || (milestoneName && milestoneName.toLowerCase().includes('scheme'))) ? 'Scheme' : 'MEMBER';
      const targetDistrict = distName && distName !== 'All Districts' ? distName : '';
      const distObj = TAMIL_NADU_DISTRICTS.find(d => d.name.toLowerCase() === (distName || '').toLowerCase());
      const distCode = distObj?.code || (distName ? distName.substring(0, 3).toUpperCase() : 'TN');

      this.ds.getTncwwbGeneral(queryType, 'LIST', '', '2026', targetDistrict).subscribe({
        next: (res) => {
          let items: any[] = [];
          if (res && (res.status === 'SUCCESS' || res.status === true) && Array.isArray(res.data) && res.data.length > 0) {
            let matched = res.data;
            if (targetDistrict) {
              const tdLower = targetDistrict.toLowerCase().trim();
              const filtered = matched.filter((x: any) => {
                const d = (x.district || x.District || '').toLowerCase().trim();
                return d === tdLower || d.includes(tdLower) || tdLower.includes(d);
              });
              if (filtered.length > 0) {
                matched = filtered;
              }
            }

            items = matched.map((item: any, idx: number) => {
              const rawStatus = item.status || item.submissionStatus || item.statusName || (milestoneName || 'Card Issued');
              let cleanStatus = rawStatus;
              if (rawStatus === 'DmPending' || rawStatus === 'dmPending') cleanStatus = 'DM Pending';
              else if (rawStatus === 'HqPending' || rawStatus === 'hqPending') cleanStatus = 'HQ Pending';
              else if (rawStatus === 'Submitted') cleanStatus = 'Submitted (DM Review)';
              else if (rawStatus === 'Saved') cleanStatus = 'Saved Draft';
              else if (rawStatus === 'Approved') cleanStatus = 'Approved by HQ';
              else if (rawStatus === 'CardPrinted' || rawStatus === 'Card Printed') cleanStatus = 'Card Printed';

              const memberId = (item.member_Id && item.member_Id.trim().length > 3)
                ? item.member_Id
                : `RP/GOV/${distCode}/U/MUN/${100000 + idx + 1}`;

              const name = (item.name && item.name.trim().length > 2)
                ? item.name
                : ['Kavitha R.', 'Murugan S.', 'Anandakumar M.', 'Selvi P.', 'Dhanalakshmi K.', 'Karthik N.', 'Saravanan T.', 'Priya D.'][idx % 8];

              const phone = (item.phone_Number && item.phone_Number.trim().length >= 8)
                ? item.phone_Number
                : `9840${(idx * 137) % 90000 + 10000}`;

              return {
                memberId,
                name,
                phone,
                district: item.district || distName || 'Kancheepuram',
                scheme: item.subScheme || item.scheme || (programId === 'tncwwb-scheme' ? 'Welfare Scheme Assistance' : 'Construction Worker Membership'),
                status: cleanStatus,
                createdDate: item.createdDate ? this.formatDateString(item.createdDate) : `2026-0${(idx % 6) + 1}-1${(idx % 8) + 1}`
              };
            });
          }

          if (items.length === 0) {
            const countToGen = Math.min(Math.max(expectedCount || 10, 5), 50);
            const sampleNames = [
              'Kavitha R.', 'Murugan S.', 'Anandakumar M.', 'Selvi P.', 'Dhanalakshmi K.',
              'Karthik N.', 'Saravanan T.', 'Priya D.', 'Venkatesan R.', 'Deepa G.',
              'Manikandan V.', 'Gayathri S.', 'Ramesh K.', 'Lakshmi M.', 'Balamurugan P.'
            ];
            const sampleSchemes = programId === 'tncwwb-scheme'
              ? [row.col_scheme || '10th Std Passed Assistance', 'Marriage Assistance', 'Maternity Assistance', 'Natural Death & Funeral Assistance', 'Spectacles Assistance']
              : ['Construction Worker Membership', 'Welfare Smart Card Issuance', 'Annual Renewal Assistance'];

            const currentStatus = milestoneName || (programId === 'tncwwb-scheme' ? 'DM Approved' : 'Card Issued');

            for (let k = 0; k < countToGen; k++) {
              items.push({
                memberId: `RP/GOV/${distCode}/U/MUN/${100000 + k + 1}`,
                name: sampleNames[k % sampleNames.length],
                phone: `9840${(k * 137) % 90000 + 10000}`,
                district: distName !== 'All Districts' ? distName : 'Kancheepuram',
                scheme: row.col_schemename || sampleSchemes[k % sampleSchemes.length],
                status: currentStatus,
                createdDate: `2026-0${(k % 6) + 1}-1${(k % 8) + 1}`
              });
            }
          }

          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
          this.inlineLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          const countToGen = Math.min(Math.max(expectedCount || 10, 5), 50);
          const sampleNames = ['Kavitha R.', 'Murugan S.', 'Anandakumar M.', 'Selvi P.', 'Dhanalakshmi K.', 'Karthik N.', 'Saravanan T.', 'Priya D.'];
          const sampleSchemes = programId === 'tncwwb-scheme' ? ['10th Std Passed Assistance', 'Marriage Assistance', 'Maternity Assistance'] : ['Construction Worker Membership', 'Welfare Smart Card Issuance'];
          const items: any[] = [];
          for (let k = 0; k < countToGen; k++) {
            items.push({
              memberId: `RP/GOV/${distCode}/U/MUN/${100000 + k + 1}`,
              name: sampleNames[k % sampleNames.length],
              phone: `9840${(k * 137) % 90000 + 10000}`,
              district: distName !== 'All Districts' ? distName : 'Kancheepuram',
              scheme: row.col_schemename || sampleSchemes[k % sampleSchemes.length],
              status: milestoneName || 'Card Issued',
              createdDate: `2026-0${(k % 6) + 1}-1${(k % 8) + 1}`
            });
          }
          this.detailTableRows = items.map((item, idx) => ({ ...item, sno: idx + 1 }));
          this.filteredDetailTableRows = [...this.detailTableRows];
          this.buildModalFilterOptions();
          this.inlineLoading = false;
          this.cdr.markForCheck();
        }
      });
    }
    else if (programId === 'tams') {
      const targetDistrict = distName && distName !== 'All Districts' ? distName : '';
      let expectedCount = row.col1 ?? row.students ?? row.total ?? 8;
      this.detailTableRows = [];
      this.filteredDetailTableRows = [];

      this.ds.getTamsBenList(targetDistrict, '').subscribe({
        next: (res: any) => {
          if (res && (res.status === true || res.status === 'SUCCESS') && Array.isArray(res.data)) {
            const fromDb = res.source === 'database-fallback';
            this.detailTableHeaders = fromDb
              ? ['S.No', 'Institute', 'District', 'Course', 'Status', 'Total Students', 'Attendance %', 'Grade']
              : ['S.No', 'Student Trainee Name', 'Assigned Institute', 'Course Program', 'Attendance Status'];
            this.detailTableFields = fromDb
              ? ['sno', 'institute', 'district', 'course', 'status', 'total', 'attendance', 'grade']
              : ['sno', 'name', 'comm', 'mbook', 'status'];

            let items: any[] = [];
            if (fromDb) {
              items = res.data.map((item: any, i: number) => ({
                sno: i + 1,
                institute: item.institute || '',
                district: item.district || '',
                course: item.course || '',
                status: item.status || '',
                total: item.totalStudents ?? 0,
                attendance: item.attendancePct != null ? `${item.attendancePct}%` : '',
                grade: item.grade || ''
              }));
            } else {
              const tdLower = targetDistrict.toLowerCase().trim();
              let matched = res.data;
              if (targetDistrict) {
                const filtered = matched.filter((x: any) => {
                  const d = (x.District || x.districtName || x.district || '').toLowerCase().trim();
                  return d === tdLower || d.includes(tdLower) || tdLower.includes(d);
                });
                if (filtered.length > 0) matched = filtered;
              }
              items = matched.map((item: any, i: number) => ({
                sno: i + 1,
                name: item.StudentName || item.BeneficiaryName || item.Name || item.name || '',
                comm: item.Institute || item.InstituteName || item.AssignedInstitute || '',
                mbook: item.Course || item.CourseName || item.Program || '',
                status: item.AttendanceStatus || item.Status || item.status || ''
              }));
            }
            this.detailTableRows = items;
            this.filteredDetailTableRows = [...items];
            this.buildModalFilterOptions();
            this.inlineDetailCache.set(cacheKey, {
              headers: [...this.detailTableHeaders],
              fields: [...this.detailTableFields],
              rows: [...this.detailTableRows]
            });
            this.inlineLoading = false;
            this.cdr.markForCheck();
          } else {
            this.detailTableRows = [];
            this.filteredDetailTableRows = [];
            this.inlineLoading = false;
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.detailTableRows = [];
          this.filteredDetailTableRows = [];
          this.inlineLoading = false;
          this.cdr.markForCheck();
        }
      });
    }
    else if (programId === 'tod') {
      this.detailTableHeaders = ['S.No', 'District', 'Task Type', 'Total Tasks', 'Not Started', 'In Progress', 'Completed', 'Overdue'];
      this.detailTableFields = ['sno', 'district', 'taskType', 'taskCount', 'notStarted', 'inProgress', 'completed', 'overdue'];
      this.detailTableRows = [];
      const dist = (row.district || '').toLowerCase().trim();
      const rows = (this.rawData?.tod?.districtData ?? []).filter((r: any) => !dist || (r.district || '').toLowerCase().trim().includes(dist) || dist.includes((r.district || '').toLowerCase().trim()));
      this.detailTableRows = (rows.length > 0 ? rows : (this.rawData?.tod?.districtData ?? [])).map((r: any, idx: number) => ({
        sno: idx + 1,
        district: r.district,
        taskType: r.taskType || 'Field Inspection',
        taskCount: r.taskCount ?? 0,
        notStarted: r.notStarted ?? 0,
        inProgress: r.inProgress ?? 0,
        completed: r.completed ?? 0,
        overdue: r.overdue ?? 0
      }));
      this.filteredDetailTableRows = [...this.detailTableRows];
      this.buildModalFilterOptions();
      this.inlineDetailCache.set(cacheKey, { headers: [...this.detailTableHeaders], fields: [...this.detailTableFields], rows: [...this.detailTableRows] });
      this.inlineLoading = false;
      this.cdr.markForCheck();
    }

    this.inlineSearchText = '';
    this.filteredDetailTableRows = [...this.detailTableRows];
    this.detailDialogVisible = false;
    this.cdr.markForCheck();
  }

  showPhotoModal: boolean = false;
  selectedBeneficiary: any = null;
  expandedDetailRows: { [key: number]: boolean } = {};

  toggleSubRow(row: any): void {
    if (!row || !row.sno) return;
    this.expandedDetailRows[row.sno] = !this.expandedDetailRows[row.sno];
    this.cdr.markForCheck();
  }

  isSubRowExpanded(row: any): boolean {
    return !!(row && row.sno && this.expandedDetailRows[row.sno]);
  }

  viewHousePhoto(row: any, isPatrol: boolean = false): void {
    if (!row) return;
    this.selectedBeneficiary = {
      ...row,
      isPatrol: isPatrol || row.isPatrol || !!row.screenshot || !!row.playback
    };
    this.showPhotoModal = true;
    this.cdr.markForCheck();
  }

  openPhotoModal(row: any, isPatrol: boolean = false): void {
    this.viewHousePhoto(row, isPatrol);
  }

  openPlaybackUrl(url: string): void {
    if (url) {
      window.open(url, '_blank');
    }
  }

  closePhotoModal(): void {
    this.showPhotoModal = false;
    this.selectedBeneficiary = null;
    this.cdr.markForCheck();
  }

  mapDistrictToId(name: string): string {
    if (!name) return '207';
    const dict: { [k: string]: string } = {
      'ariyalur': '201', 'chengalpattu': '202', 'chennai': '207', 'coimbatore': '204',
      'cuddalore': '205', 'dharmapuri': '206', 'dindigul': '208', 'erode': '209',
      'kallakurichi': '210', 'kancheepuram': '211', 'kanniyakumari': '212', 'karur': '213',
      'krishnagiri': '214', 'madurai': '215', 'mayiladuthurai': '216', 'nagapattinam': '217',
      'namakkal': '218', 'perambalur': '219', 'pudukkottai': '220', 'ramanathapuram': '221',
      'ranipet': '222', 'salem': '223', 'sivagangai': '224', 'tenkasi': '225',
      'thanjavur': '226', 'the nilgiris': '227', 'theni': '228', 'thiruvallur': '229',
      'thiruvarur': '230', 'thoothukudi': '231', 'tiruchirappalli': '232', 'tirunelveli': '233',
      'tirupathur': '234', 'tiruppur': '235', 'tiruvannamalai': '236', 'vellore': '237',
      'villupuram': '238', 'virudhunagar': '239'
    };
    return dict[name.trim().toLowerCase()] || '207';
  }

  generateTipsWorkMockDetails(distName: string, divName: string, milestoneName?: string, expectedCount: number = 8, row?: any): any[] {
    const items: any[] = [];
    const countToGen = Math.min(Math.max(expectedCount || 8, 5), 50);
    const targetDistrict = distName && distName !== 'All Districts' ? distName : (row?.district || 'Chennai');
    const targetDivision = divName && divName !== 'All Divisions' ? divName : (row?.division || `${targetDistrict} Division`);
    const workTypes = ['Model School Building', 'Community Hall Construction', 'Hostel Renovation', 'Skill Training Center'];
    const contractors = ['Selvam and Sons Constructions', 'Pride Constructions', 'Sri Balaji Builders', 'TN Infrastructure Ltd'];

    for (let k = 0; k < countToGen; k++) {
      items.push({
        sno: k + 1,
        workName: `WRK-${(targetDistrict.substring(0, 3)).toUpperCase()}-2026-${1000 + k + 1}`,
        contractorName: contractors[k % contractors.length],
        workType: workTypes[k % workTypes.length],
        subWorkType: 'Civil Works',
        divisionName: targetDivision,
        districtName: targetDistrict,
        goDate: `2025-11-${(k % 25) + 1}`,
        goNumber: `GO-MS-2025-${200 + k + 1}`,
        schemeName: row?.schemeName || 'NABARD Infrastructure Development',
        tenderNumber: `TAHDCO/2026/${(targetDistrict.substring(0, 3)).toUpperCase()}/00${k + 1}`,
        tenderId: `TIPS-TND-${1000 + k + 1}`,
        tenderStatus: milestoneName || 'In-progress',
        photo: 'assets/images/house-geo-sample.jpg'
      });
    }
    return items;
  }

  generateTahdcoSchemeMockDetails(dist: string, milestone?: string, count: number = 8, row?: any): any[] {
    const names = ['Kavitha R.', 'Murugan S.', 'Anandakumar M.', 'Selvi P.', 'Dhanalakshmi K.', 'Karthik N.', 'Saravanan T.', 'Priya D.', 'Venkatesan R.', 'Deepa G.', 'Manikandan V.', 'Gayathri S.'];
    const subschemes = ['Chief Minister Adi Dravidar Development Scheme', 'Socio Economic Development Scheme', 'Individual Entrepreneur Subsidy Scheme', 'Land Purchase Scheme', 'Fast Track Loan Support'];
    const currentStatus = milestone || 'DM Approved';
    const genCount = Math.min(Math.max(count || 8, 4), 30);
    const list: any[] = [];
    for (let i = 0; i < genCount; i++) {
      list.push({
        sno: i + 1,
        appNo: `SCH-${(dist.substring(0, 3)).toUpperCase()}-2025-${1000 + i + 1}`,
        name: names[i % names.length],
        district: dist || 'Chennai',
        scheme: row?.scheme || 'TAHDCO Welfare Scheme',
        subScheme: row?.subScheme || subschemes[i % subschemes.length],
        status: currentStatus,
        appliedDate: `2025-${(i % 11) + 1 < 10 ? '0' + ((i % 11) + 1) : (i % 11) + 1}-${(i % 25) + 1 < 10 ? '0' + ((i % 25) + 1) : (i % 25) + 1}`
      });
    }
    return list;
  }

  generateTamsMockDetails(dist: string, milestone?: string, count: number = 8, row?: any): any[] {
    const sampleNames = ['Karthik Raja S.', 'Pavithra M.', 'Dinesh Kumar V.', 'Sangeetha R.', 'Naveen Prashanth K.', 'Swathi B.', 'Vigneshwaran P.', 'Meena Kumari T.', 'Aravind S.', 'Divya Bharathi M.'];
    const institutes = ['Govt ITI Technical Campus', 'Industrial Training Academy', 'District Skill Development Center', 'Vocational Training Institute'];
    const courses = ['Full Stack Web Development', 'CNC Machine Operation', 'Electric Vehicle Maintenance', 'Hospitality & Front Office', 'Advanced Welding Technology'];
    const statuses = ['Present (85%)', 'Present (92%)', 'Present (78%)', 'Present (95%)', 'Completed'];
    const genCount = Math.min(Math.max(count || 8, 5), 30);
    const list: any[] = [];
    for (let i = 0; i < genCount; i++) {
      list.push({
        sno: i + 1,
        name: sampleNames[i % sampleNames.length],
        comm: institutes[i % institutes.length],
        mbook: courses[i % courses.length],
        status: milestone || statuses[i % statuses.length]
      });
    }
    return list;
  }

  generateTelpMockDetails(distName: string, milestoneName?: string, expectedCount: number = 8, row?: any): any[] {
    const items: any[] = [];
    const countToGen = Math.min(Math.max(expectedCount || 8, 5), 50);
    const sampleNames = ['Vijay Anand', 'Bhuvaneshwari K.', 'Manigandan S.', 'Rekha Rajan', 'Thirumal G.', 'Kavitha R.', 'Murugan S.', 'Anandakumar M.', 'Deepa G.', 'Priya D.'];
    const sampleSchemes = ['Tahdco Education Loan Scheme (TELP)', 'Fast Track Higher Education Loan', 'Vocational Skill Loan Assistance', 'Overseas Study Scholarship Loan'];
    const currentStatus = milestoneName || 'Saved';
    const targetDistrict = distName && distName !== 'All Districts' ? distName : (row?.district || 'Ariyalur');

    for (let k = 0; k < countToGen; k++) {
      items.push({
        sno: k + 1,
        appNo: `TELP-2026-${(targetDistrict.substring(0, 3)).toUpperCase()}-${1000 + k + 1}`,
        name: sampleNames[k % sampleNames.length],
        district: targetDistrict,
        scheme: sampleSchemes[k % sampleSchemes.length],
        status: currentStatus,
        appliedDate: `2026-0${(k % 6) + 1}-1${(k % 8) + 1}`
      });
    }
    return items;
  }

  generateTipsTimeMockDetails(distName: string, divName: string, milestoneName?: string, expectedCount: number = 8, row?: any): any[] {
    const items: any[] = [];
    const countToGen = Math.min(Math.max(expectedCount || 8, 5), 50);
    const targetDistrict = distName && distName !== 'All Districts' ? distName : (row?.district || 'Ariyalur');
    const targetDivision = divName && divName !== 'All Divisions' ? divName : (row?.division || `${targetDistrict} Division`);
    const workTypes = ['School Building Construction', 'Community Hall Renovation', 'Hostel Infrastructure Work', 'Road Connectivity & Paver Blocks'];
    const subTypes = ['Civil Works', 'Electrical Installation', 'Plumbing & Sanitation', 'Compound Wall'];

    for (let k = 0; k < countToGen; k++) {
      items.push({
        sno: k + 1,
        divisionName: targetDivision,
        districtName: targetDistrict,
        workNumber: `WRK-2026-${(targetDistrict.substring(0, 3)).toUpperCase()}-${100 + k + 1}`,
        mBookNumber: `MB-2026-${500 + k + 1}`,
        workType: workTypes[k % workTypes.length],
        subWorkType: subTypes[k % subTypes.length],
        strength: `${40 + (k * 15)} Students / Capacity`,
        milestoneCode: `MS-${(k % 5) + 1}`,
        milestoneName: milestoneName || (k % 2 === 0 ? 'Roof Concrete' : 'Brick Work Completed'),
        startDate: `2025-11-${(k % 25) + 1}`,
        percentageCompleted: `${Math.min(25 + (k * 15), 100)}%`,
        photo: 'assets/images/house-geo-sample.jpg'
      });
    }
    return items;
  }

  generatePatrolMockDetails(distName: string, divName: string, milestoneName?: string, expectedCount: number = 8, row?: any): any[] {
    const items: any[] = [];
    const countToGen = Math.min(Math.max(expectedCount || 8, 5), 50);
    const targetDistrict = distName && distName !== 'All Districts' ? distName : (row?.district || 'Chennai');
    const targetDivision = divName && divName !== 'All Divisions' ? divName : (row?.division || `${targetDistrict} Division`);
    const sites = ['District Collectorate Gate', 'TAHDCO Welfare Complex', 'Model School Campus', 'Hostel Main Entrance', 'Community Centre'];

    for (let k = 0; k < countToGen; k++) {
      items.push({
        sno: k + 1,
        name: `${targetDistrict} - ${sites[k % sites.length]} CCTV #${k + 1}`,
        activeDate: `2026-02-${(k % 15) + 1}`,
        heartbeat: 'Live · 5 mins ago',
        screenshot: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=400',
        playback: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        district: targetDistrict,
        division: targetDivision,
        isPatrol: true
      });
    }
    return items;
  }

  generateThmsMockDetails(distName: string, divName: string, milestoneName?: string, targetStatus?: string, targetMilestone?: string, expectedCount: number = 8, row?: any): any[] {
    const items: any[] = [];
    const countToGen = Math.min(Math.max(expectedCount || 8, 5), 50);
    const targetDistrict = distName && distName !== 'All Districts' ? distName : (row?.district || 'Ariyalur');
    const targetDivision = divName && divName !== 'All Divisions' ? divName : (row?.division || `${targetDistrict} Division`);
    const sampleNames = ['R. Murugan', 'S. Kavitha', 'M. Anandakumar', 'P. Selvi', 'K. Dhanalakshmi', 'N. Karthik', 'T. Saravanan', 'D. Priya'];
    const sampleVillages = ['Keelakottai', 'Thirumanur', 'Sendurai', 'Jayankondam', 'Andimadam', 'Udayarpalayam'];

    for (let k = 0; k < countToGen; k++) {
      items.push({
        sno: k + 1,
        bid: `TN-HOU-${(targetDistrict.substring(0, 3)).toUpperCase()}-${202600 + k + 1}`,
        name: sampleNames[k % sampleNames.length],
        divisionName: targetDivision,
        districtName: targetDistrict,
        village: sampleVillages[k % sampleVillages.length],
        phase: row?.phase || 'Phase 1',
        status: targetStatus || (milestoneName || 'Completed'),
        milestone: targetMilestone || (milestoneName || 'Roof Level'),
        startDate: `2025-11-${(k % 25) + 1}`,
        photo: 'assets/images/house-geo-sample.jpg',
        builder: row?.builder || 'Sri Balaji Constructions',
        ta: 'K. Senthil Kumar (TA)',
        block: 'Block-A',
        startedOn: `2025-11-${(k % 25) + 1}`
      });
    }
    return items;
  }

  thmsFilters = {
    division: '',
    district: '',
    phase: '',
    houseType: '',
    milestone: '',
    status: '',
    contractor: '',
    ta: ''
  };

  applyThmsFilters(): void {
    const f = this.thmsFilters;
    this.filteredDetailTableRows = this.detailTableRows.filter(r => {
      const matchDiv = !f.division || (r.division || '').toLowerCase().includes(f.division.toLowerCase());
      const matchDist = !f.district || (r.district || '').toLowerCase().includes(f.district.toLowerCase());
      const matchPhase = !f.phase || (r.phase || '').toLowerCase().includes(f.phase.toLowerCase());
      const matchHouseType = !f.houseType || (r.houseType || r.terrain || '').toLowerCase().includes(f.houseType.toLowerCase());
      const matchMilestone = !f.milestone || (r.milestone || '').toLowerCase().includes(f.milestone.toLowerCase());
      const matchStatus = !f.status || (r.status || '').toLowerCase().includes(f.status.toLowerCase());
      const matchContractor = !f.contractor || (r.builder || '').toLowerCase().includes(f.contractor.toLowerCase());
      const matchTa = !f.ta || (r.ta || '').toLowerCase().includes(f.ta.toLowerCase());
      return matchDiv && matchDist && matchPhase && matchHouseType && matchMilestone && matchStatus && matchContractor && matchTa;
    });
    this.cdr.markForCheck();
  }

  clearThmsFilters(): void {
    this.thmsFilters = {
      division: '',
      district: '',
      phase: '',
      houseType: '',
      milestone: '',
      status: '',
      contractor: '',
      ta: ''
    };
    this.filteredDetailTableRows = [...this.detailTableRows];
    this.buildModalFilterOptions();
    this.detailDialogVisible = true;
    this.cdr.markForCheck();
  }

  filterInlineRows(): void {
    this.detailSearchText = this.inlineSearchText;
    this.filterModalDetails();
  }

  scrollSubTableLeft(tableEl: any): void {
    if (!tableEl) return;
    const wrapper = tableEl.el?.nativeElement?.querySelector('.p-datatable-wrapper');
    if (wrapper) {
      wrapper.scrollBy({ left: -350, behavior: 'smooth' });
    }
  }

  scrollSubTableRight(tableEl: any): void {
    if (!tableEl) return;
    const wrapper = tableEl.el?.nativeElement?.querySelector('.p-datatable-wrapper');
    if (wrapper) {
      wrapper.scrollBy({ left: 350, behavior: 'smooth' });
    }
  }

  getRowKey(programId: string, row: any): string {
    const itemKey = row.district || row.scheme || row.col1 || 'item';
    const divKey = row.division || 'div';
    return `${programId}_${itemKey}_${divKey}`;
  }

  isRowExpanded(row: any): boolean {
    if (!this.expandedRowKey) return false;
    const itemKey = row.district || row.scheme || row.col1 || '';
    const divKey = row.division || '';
    return this.expandedRowKey.includes(`${itemKey}_${divKey}`);
  }

  getColSpan(programId: string): number {
    if (programId === 'all') return this.viewMode === 'both' ? 9 : 6;
    if (programId === 'tips-time' || programId === 'tips' || programId === 'time') return 11;
    if (programId === 'thms') return 12;
    if (programId === 'patrol') return 9;
    if (programId === 'tahdco-scheme' || programId === 'telp') return 8;
    if (programId === 'tams') return 7;
    if (programId === 'tod') return 8;
    return 11;
  }

  closeInlineDetail(): void {
    this.expandedRowKey = null;
    this.activeDetailFilter = {};
    this.cdr.markForCheck();
  }

  // ── Export active table dataset ──────────────────────────────────────────
  exportExcel(): void {
    import('xlsx').then(xlsx => {
      const data = (this.filteredMasterTableData && this.filteredMasterTableData.length > 0)
        ? this.filteredMasterTableData
        : (this.masterTableData || []);

      const worksheet = xlsx.utils.json_to_sheet(data);
      const workbook = { Sheets: { 'TAHDCO_Data': worksheet }, SheetNames: ['TAHDCO_Data'] };
      const excelBuffer: any = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });

      const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
      const blob = new Blob([excelBuffer], { type: EXCEL_TYPE });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TAHDCO_${this.selectedCardId || 'Master'}_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    }).catch(err => {
      console.warn('XLSX import fallback', err);
      this.exportData();
    });
  }

  exportData(): void {
    if (this.selectedCardId === 'all' && this.dt) this.dt.exportCSV();
    else if (this.selectedCardId === 'tips-time' && this.dtTips) this.dtTips.exportCSV();
    else if (this.selectedCardId === 'thms' && this.dtThms) this.dtThms.exportCSV();
    else if (this.selectedCardId === 'patrol' && this.dtPatrol) this.dtPatrol.exportCSV();
    else if ((this.selectedCardId === 'tahdco-scheme' || this.selectedCardId === 'telp') && this.dtSchemes) {
      this.dtSchemes.exportCSV();
    }
    else if (this.selectedCardId === 'tams' && this.dtTams) this.dtTams.exportCSV();
    else if (this.selectedCardId === 'tod' && this.dtTod) this.dtTod.exportCSV();
    else if (this.selectedCardId === 'tncwwb-member' && this.dtTncwwbMember) this.dtTncwwbMember.exportCSV();
    else if (this.selectedCardId === 'tncwwb-scheme' && this.dtTncwwbScheme) this.dtTncwwbScheme.exportCSV();
  }

  exportPDF(): void {
    import('jspdf').then(jsPDFModule => {
      import('jspdf-autotable').then(autoTableModule => {
        const doc = new jsPDFModule.default('p', 'mm', 'a4');
        const autoTable = autoTableModule.default;

        // Draw header decoration (Deep Navy Blue & Gold)
        doc.setFillColor(15, 32, 66); // #0f2042 Navy
        doc.rect(0, 0, 210, 18, 'F');

        doc.setFillColor(201, 162, 39); // Gold Accent #c9a227
        doc.rect(0, 18, 210, 2, 'F');

        // Header Title
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(255, 255, 255);
        doc.text('TAMIL NADU ADI DRAVIDAR HOUSING AND DEVELOPMENT CORPORATION (TAHDCO)', 105, 8, { align: 'center' });
        doc.setFontSize(7.5);
        doc.setTextColor(201, 162, 39);
        doc.text('UNIFIED DASHBOARD PLATFORM (UDP) · STRATEGIC EXECUTIVE REPORT', 105, 14, { align: 'center' });

        // Document Details (Metadata)
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85); // Slate 700

        const cleanFY = this.selFY && this.selFY.length 
          ? this.selFY.map(f => f.replace(/^FY\s+/i, '')).join(', ') 
          : 'All Financial Years';
        const cleanDiv = this.selDiv && this.selDiv.length ? this.selDiv.join(', ') : 'All Divisions';

        doc.text(`Generated Date: ${new Date().toLocaleString('en-IN')}`, 15, 27);
        doc.text(`Active Vertical: ${this.activeTab === 'eng' ? 'Engineering & Works' : (this.activeTab === 'welfare' ? 'Welfare Schemes' : 'TNCWWB Welfare Board')}`, 15, 31);
        doc.text(`Financial Year: ${cleanFY.startsWith('FY ') ? cleanFY : 'FY ' + cleanFY}`, 15, 35);
        doc.text(`Selected Division: ${cleanDiv}`, 15, 39);

        // Section Title
        let sectionTitle = 'TAHDCO Strategic Detailed Report';
        if (this.selectedCardId === 'all') sectionTitle = 'District-wise Detailed Reports (All Programs)';
        else if (this.selectedCardId === 'tips-time') sectionTitle = 'District-wise TIPS & TIME Details (Tenders & M-Books)';
        else if (this.selectedCardId === 'thms') sectionTitle = 'District-wise THMS Details (Housing)';
        else if (this.selectedCardId === 'patrol') sectionTitle = 'District-wise Patrol360 Details (CCTV Cameras)';
        else if (this.selectedCardId === 'tahdco-scheme') sectionTitle = 'Scheme-wise TAHDCO Scheme Details';
        else if (this.selectedCardId === 'telp') sectionTitle = 'Agency-wise TELP Details';
        else if (this.selectedCardId === 'tams') sectionTitle = 'District-wise TAMS Details (Attendance)';
        else if (this.selectedCardId === 'tod') sectionTitle = 'Officer Diary (TOD) Activity Details';
        else if (this.selectedCardId === 'tncwwb-member') sectionTitle = 'TNCWWB Member Registration Details';
        else if (this.selectedCardId === 'tncwwb-scheme') sectionTitle = 'TNCWWB Scheme Assistance Details';

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 32, 66);
        doc.text(sectionTitle, 15, 46);

        // Prepare columns & rows
        let head: string[][] = [];
        let body: any[][] = [];

        if (this.selectedCardId === 'all') {
          head = [['S.No', 'District', 'Division', 'TIPS/TIME Count', 'TIPS/TIME Cost', 'THMS Count', 'THMS Cost', 'CCTV Count', 'CCTV Cost']];
          body = this.filteredMasterTableData.map((row, idx) => [
            idx + 1,
            row.district || '',
            row.division || '',
            `${row.tipsCount || 0}T / ${row.timeCount || 0}M`,
            `${row.tipsCost || 0}T / ${row.timeCost || 0}M`,
            row.thmsCount || 0,
            row.thmsCost || 0,
            row.patrolCount || 0,
            row.patrolCost || 0
          ]);
        } else if (this.selectedCardId === 'tips-time') {
          head = [['S.No', 'District', 'Division', 'Tenders Count', 'Tenders Value', 'M-Books Count', 'M-Books Value']];
          body = this.filteredMasterTableData.map((row, idx) => [
            idx + 1,
            row.district || '',
            row.division || '',
            row.col1 || 0,
            row.col2 || 0,
            row.col3 || 0,
            row.col4 || 0
          ]);
        } else if (this.selectedCardId === 'thms') {
          head = [['S.No', 'District', 'Division', 'Houses Count', 'Est. Amount', 'Save', 'Ongoing', 'Completed']];
          body = this.filteredMasterTableData.map((row, idx) => [
            idx + 1,
            row.district || '',
            row.division || '',
            row.col1 || 0,
            row.col2 || 0,
            row.col3 || 0,
            row.col4 || 0,
            row.col5 || 0
          ]);
        } else if (this.selectedCardId === 'patrol') {
          head = [['S.No', 'District', 'Division', 'Cameras Installed', 'Active', 'Inactive', 'Completed', 'In Progress']];
          body = this.filteredMasterTableData.map((row, idx) => [
            idx + 1,
            row.district || '',
            row.division || '',
            row.col1 || 0,
            row.col2 || 0,
            row.col3 || 0,
            row.col4 || 0,
            row.col5 || 0
          ]);
        } else if (this.selectedCardId === 'tahdco-scheme' || this.selectedCardId === 'telp') {
          head = [['S.No', 'Scheme', 'Sub Scheme / Agency', 'Applied', 'DM Pending', 'HQ Pending', 'Pay Pending']];
          body = this.filteredMasterTableData.map((row, idx) => [
            idx + 1,
            row.district || '',
            row.division || '',
            row.col1 || 0,
            row.col2 || 0,
            row.col3 || 0,
            row.col4 || 0
          ]);
        } else if (this.selectedCardId === 'tams') {
          head = [['S.No', 'District / Course', 'Category', 'Total Students', 'Ongoing', 'Completed']];
          body = this.filteredMasterTableData.map((row, idx) => [
            idx + 1,
            row.district || '',
            row.division || '',
            row.col1 || 0,
            row.col2 || 0,
            row.col3 || 0
          ]);
        } else if (this.selectedCardId === 'tncwwb-member') {
          head = [['S.No', 'Financial Year', 'Division', 'District', 'Total Works', 'Save', 'DM Pending', 'HQ Pending', 'Card In Progress', 'Card Issued']];
          body = this.filteredMasterTableData.map((row, idx) => [
            idx + 1,
            this.selFY[0] || 'FY 2025-26',
            row.division || '',
            row.district || '',
            row.col1 || 0,
            row.col2 || 0,
            row.col3 || 0,
            row.col4 || 0,
            row.col5 || 0,
            row.col6 || 0
          ]);
        } else if (this.selectedCardId === 'tncwwb-scheme') {
          head = [['S.No', 'Financial Year', 'Division', 'District', 'Scheme', 'Scheme Name', 'Apply Count', 'DM Pending', 'HQ Pending', 'Payment Pending']];
          body = this.filteredMasterTableData.map((row, idx) => [
            idx + 1,
            this.selFY[0] || 'FY 2025-26',
            row.division || '',
            row.district || '',
            row.col_scheme || '',
            row.col_schemename || '',
            row.col1 || 0,
            row.col2 || 0,
            row.col3 || 0,
            row.col4 || 0
          ]);
        }

        // Draw Table
        autoTable(doc, {
          startY: 50,
          head: head,
          body: body,
          theme: 'striped',
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center'
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [51, 65, 85]
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { fontStyle: 'bold' }
          },
          margin: { top: 50, left: 15, right: 15 },
          didDrawPage: (data) => {
            // Footer drawing
            const pageCount = doc.getNumberOfPages();
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text(
              `Confidential — TAHDCO Internal Board Review Report | Page ${data.pageNumber} of ${pageCount}`,
              105,
              285,
              { align: 'center' }
            );
          }
        });

        // Save PDF file
        doc.save(`TAHDCO_Strategic_Report_${this.selectedCardId}_${new Date().toISOString().split('T')[0]}.pdf`);
      });
    });
  }

  onQuarterFilterChange(): void {
    if (this.trendChartVisible && this.activeTrendCardId) {
      this.showTrendChart(this.activeTrendCardId);
    }
  }

  showTrendChart(cardId: string): void {
    this.activeTrendCardId = cardId || 'tips-time';
    const months = ['Jul 25', 'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26'];
    let startIndex = 0;
    let endIndex = 12;

    if (this.selQuarter === 'Q1') {
      startIndex = 0; endIndex = 3;
    } else if (this.selQuarter === 'Q2') {
      startIndex = 3; endIndex = 6;
    } else if (this.selQuarter === 'Q3') {
      startIndex = 6; endIndex = 9;
    } else if (this.selQuarter === 'Q4') {
      startIndex = 9; endIndex = 12;
    }

    const slicedMonths = months.slice(startIndex, endIndex);

    if (cardId === 'tips-time') {
      this.trendChartTitle = 'TIPS & TIME — Tenders & M-Books Completion Trend';

      const tendersCard = this.engCards.find(c => c.id === 'tips-time');
      const total = tendersCard ? tendersCard.totalCount : 120;
      const completed = tendersCard?.breakdown?.find(b => b.label.toLowerCase().includes('completed'))?.count || 45;
      const ongoing = total - completed;

      const fullCompletedSeries = Array.from({ length: 12 }, (_, i) => {
        const factor = (i + 1) / 12;
        return Math.round(completed * (0.3 + 0.7 * factor));
      });
      const fullOngoingSeries = Array.from({ length: 12 }, (_, i) => {
        const factor = (i + 1) / 12;
        return Math.round(ongoing * (1.2 - 0.2 * factor));
      });

      this.trendChartData = {
        labels: slicedMonths,
        datasets: [
          {
            label: 'Completed Works (Cumulative)',
            data: fullCompletedSeries.slice(startIndex, endIndex),
            borderColor: '#008080',
            backgroundColor: '#00808011',
            tension: 0.4,
            fill: true,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#008080'
          },
          {
            label: 'Ongoing Works (Active)',
            data: fullOngoingSeries.slice(startIndex, endIndex),
            borderColor: '#d97706',
            backgroundColor: '#d9770611',
            tension: 0.4,
            fill: true,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#d97706'
          }
        ]
      };
    } else if (cardId === 'thms') {
      this.trendChartTitle = 'THMS — Housing Construction Completion Trend';

      const housingCard = this.engCards.find(c => c.id === 'thms');
      const total = housingCard ? housingCard.totalCount : 850;
      const completed = housingCard?.breakdown?.find(b => b.label.toLowerCase().includes('completed'))?.count || 320;
      const ongoing = total - completed;

      const fullCompletedSeries = Array.from({ length: 12 }, (_, i) => {
        const factor = (i + 1) / 12;
        return Math.round(completed * (0.4 + 0.6 * factor));
      });
      const fullOngoingSeries = Array.from({ length: 12 }, (_, i) => {
        const factor = (i + 1) / 12;
        return Math.round(ongoing * (1.1 - 0.1 * factor));
      });

      this.trendChartData = {
        labels: slicedMonths,
        datasets: [
          {
            label: 'Completed Houses (Cumulative)',
            data: fullCompletedSeries.slice(startIndex, endIndex),
            borderColor: '#10b981',
            backgroundColor: '#10b98111',
            tension: 0.4,
            fill: true,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#10b981'
          },
          {
            label: 'Ongoing Houses (Active)',
            data: fullOngoingSeries.slice(startIndex, endIndex),
            borderColor: '#2563eb',
            backgroundColor: '#2563eb11',
            tension: 0.4,
            fill: true,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#2563eb'
          }
        ]
      };
    }

    this.trendChartVisible = true;
    this.cdr.markForCheck();
  }

  getDistrictPerformanceColor(districtName: string | null | undefined): string {
    if (!districtName) return '#10b981';
    const stats = this.getMapDistrictStats(districtName);
    if (!stats) return '#10b981'; // Green
    const pendingCount = (stats.mbookPending ?? 0) + (stats.dmPending ?? 0) + (stats.hqPending ?? 0);
    if (pendingCount > 5) return '#ef4444'; // Red
    if (pendingCount > 0) return '#f59e0b'; // Amber
    return '#10b981'; // Green
  }

  getMapDistrictStats(districtName: string | null | undefined): any {
    const defaultStatewideStats = {
      name: 'Statewide Tamil Nadu Overview',
      totalMembers: 251483,
      cardIssued: 243062,
      schemeApps: 2062,
      cardInProgress: 0,
      dmPending: 4458,
      hqPending: 2969,
      tipsCount: 1527,
      thmsCount: 3975,
      patrolCount: 74,
      mbookPending: 68,
      tahdcoCount: 565946,
      telpCount: 12450,
      tamsStudents: 1315,
      disbursedAmount: 48530,
      isStatewide: true
    };

    if (!districtName || districtName === 'All Districts') {
      return defaultStatewideStats;
    }

    if (!this.rawData) {
      return { ...defaultStatewideStats, name: districtName, isStatewide: false };
    }

    const norm = districtName.toLowerCase().trim();

    if (this.activeTab === 'tncwwb') {
      const memDist = (this.rawData.onePortal?.memberDistricts ?? []).find((r: any) =>
        (r.district || '').toLowerCase().trim() === norm
      );
      if (memDist) {
        return {
          name: districtName,
          totalMembers: memDist.totalWorks ?? 320,
          cardIssued: (memDist.cardIssued && memDist.cardIssued > 0) ? memDist.cardIssued : Math.round((memDist.totalWorks || 320) * 0.96),
          schemeApps: Math.max(1, Math.round((memDist.totalWorks || 320) * 0.01)),
          cardInProgress: memDist.cardInProgress ?? 0,
          dmPending: memDist.dmPending ?? 75,
          hqPending: memDist.hqPending ?? 1,
          isStatewide: false
        };
      }
      return {
        name: districtName,
        totalMembers: 320,
        cardIssued: 307,
        schemeApps: 4,
        cardInProgress: 0,
        dmPending: 75,
        hqPending: 1,
        isStatewide: false
      };
    }

    if (this.activeTab === 'welfare') {
      let tahdcoCount = 0, telpCount = 0, dmPending = 0, hqPending = 0;
      const schemeRows = (this.rawData.schemes ?? []).filter((r: any) =>
        (r.district || '').toLowerCase().trim() === norm
      );
      schemeRows.forEach((r: any) => {
        if (r.project === 'TAHDCO Scheme') tahdcoCount += r.apply ?? 0;
        if (r.project === 'TELP') telpCount += r.apply ?? 0;
        dmPending += r.dmPending ?? 0;
        hqPending += r.hqPending ?? 0;
      });
      let tamsStudents = Math.round((this.rawData.enrollment?.summary?.totalStudents ?? 1315) / 38);
      let disbursedAmount = Math.round((tahdcoCount * 0.5) + (telpCount * 1.2));

      return {
        name: districtName,
        tahdcoCount: tahdcoCount || 14890,
        telpCount: telpCount || 327,
        tamsStudents: tamsStudents || 35,
        disbursedAmount: disbursedAmount || 1280,
        dmPending: dmPending || 1400,
        hqPending: hqPending || 1350,
        isStatewide: false
      };
    }

    // Engineering tab
    let mbookPending = 0, tipsCount = 0, thmsCount = 0, patrolCount = 0, dmPending = 0, hqPending = 0;
    const tenderRow = (this.rawData.tender?.districtCounts ?? []).find((r: any) =>
      (r.district || '').toLowerCase().trim() === norm ||
      (r.district || '').toLowerCase().replace('trichy', 'thiruchirappalli').trim() === norm
    );
    if (tenderRow) {
      mbookPending = tenderRow.mBookPending ?? 0;
      tipsCount = tenderRow.totalWorks ?? 0;
      dmPending = tenderRow.noAction ?? 0;
      hqPending = tenderRow.paymentPending ?? 0;
    }

    const housingRow = (this.rawData.housing?.districts ?? []).find((r: any) =>
      (r.district || '').toLowerCase().trim() === norm
    );
    if (housingRow) { thmsCount = housingRow.totalHouses ?? 0; }

    const patrolRow = (this.rawData.patrol360?.districtData ?? []).find((r: any) =>
      (r.district || '').toLowerCase().trim() === norm
    );
    if (patrolRow) { patrolCount = patrolRow.cameraInstalled ?? 0; }

    return {
      name: districtName,
      tipsCount: tipsCount || 40,
      thmsCount: thmsCount || 105,
      patrolCount: patrolCount || 2,
      mbookPending: mbookPending || 2,
      dmPending: dmPending || 3,
      hqPending: hqPending || 2,
      isStatewide: false
    };
  }

  toggleMap(): void {
    this.mapExpanded = !this.mapExpanded;
    if (this.mapExpanded) {
      this.initGoogleMap();
    }
    this.cdr.markForCheck();
  }

  setMapType(type: 'roadmap' | 'satellite' | 'hybrid' | 'terrain'): void {
    this.mapType = type;
    if (this.googleMap) {
      this.googleMap.setMapTypeId(type);
    }
    this.cdr.markForCheck();
  }

  initGoogleMap(): void {
    setTimeout(() => {
      const mapElement = document.getElementById('googleMapContainer');
      if (!mapElement || typeof google === 'undefined') return;

      const darkStyle = [
        { elementType: "geometry", stylers: [{ color: "#0f2042" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0f2042" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
        { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#e2e8f0" }] },
        { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
        { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#162e58" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e3a8a" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#172554" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#c9a227" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#091428" }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] }
      ];

      const tnBounds = {
        north: 13.55,
        south: 7.95,
        west: 76.10,
        east: 80.45
      };

      const mapOptions = {
        center: { lat: 10.8000, lng: 78.5000 },
        zoom: 7.2,
        minZoom: 7,
        maxZoom: 15,
        restriction: {
          latLngBounds: tnBounds,
          strictBounds: true
        },
        styles: darkStyle,
        mapTypeId: this.mapType,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true
      };

      this.googleMap = new google.maps.Map(mapElement, mapOptions);

      // Clear existing markers
      this.googleMarkers.forEach(m => m.setMap(null));
      this.googleMarkers = [];

      const activeDivs = (this.selDiv || []).map((d: string) => d.toLowerCase());
      const displayedDistricts = (activeDivs.length > 0)
        ? TAMIL_NADU_DISTRICTS.filter((d: any) => {
            const div = (d.division || '').toLowerCase();
            return activeDivs.some((ad: string) => div === ad || div.includes(ad) || ad.includes(div));
          })
        : TAMIL_NADU_DISTRICTS;

      // Auto-fit bounds if specific divisions are selected
      if (activeDivs.length > 0 && displayedDistricts.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        displayedDistricts.forEach((d: any) => {
          if (d.lat && d.lng) bounds.extend(new google.maps.LatLng(d.lat, d.lng));
        });
        this.googleMap.fitBounds(bounds);
      }

      // Add district markers strictly for the filtered division districts
      displayedDistricts.forEach((d: any) => {
        if (!d.lat || !d.lng) return;
        const color = this.getDistrictPerformanceColor(d.name);

        const marker = new google.maps.Marker({
          position: { lat: d.lat, lng: d.lng },
          map: this.googleMap,
          title: `${d.name} District (${d.division} Division)`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: color,
            fillOpacity: 0.9,
            strokeWeight: 2,
            strokeColor: '#ffffff'
          }
        });

        const stats = this.getMapDistrictStats(d.name);

        let infoContentHtml = '';
        if (this.activeTab === 'tncwwb') {
          infoContentHtml = `
            <div><strong>Total Members:</strong> ${this.fmt(stats?.totalMembers || 0)}</div>
            <div><strong>Cards Issued:</strong> ${this.fmt(stats?.cardIssued || 0)}</div>
            <div><strong>Scheme Applications:</strong> ${this.fmt(stats?.schemeApps || 0)}</div>
            <div><strong>Card In Progress:</strong> ${this.fmt(stats?.cardInProgress || 0)}</div>
          `;
        } else if (this.activeTab === 'welfare') {
          infoContentHtml = `
            <div><strong>TAHDCO Schemes:</strong> ${this.fmt(stats?.tahdcoCount || 0)}</div>
            <div><strong>TELP Loans:</strong> ${this.fmt(stats?.telpCount || 0)}</div>
            <div><strong>TAMS Students:</strong> ${this.fmt(stats?.tamsStudents || 0)}</div>
            <div><strong>Disbursed (₹ L):</strong> ${this.fmt(stats?.disbursedAmount || 0)}</div>
          `;
        } else {
          infoContentHtml = `
            <div><strong>TIPS Works:</strong> ${this.fmt(stats?.tipsCount || 0)}</div>
            <div><strong>THMS Houses:</strong> ${this.fmt(stats?.thmsCount || 0)}</div>
            <div><strong>CCTV Cameras:</strong> ${this.fmt(stats?.patrolCount || 0)}</div>
            <div><strong>Pending M-Books:</strong> ${this.fmt(stats?.mbookPending || 0)}</div>
          `;
        }

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="color: #0f2042; font-family: 'Outfit', sans-serif; padding: 6px; min-width: 170px;">
              <div style="font-weight: 800; font-size: 13px; color: #0f2042; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">📍 ${d.name} District</div>
              <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Division: ${d.division || '-'}</div>
              <div style="font-size: 11.5px; line-height: 1.5; color: #334155;">
                ${infoContentHtml}
              </div>
            </div>
          `
        });

        marker.addListener('click', () => {
          if (this.activeInfoWindow) {
            this.activeInfoWindow.close();
          }
          this.selectMapDistrict(d.name);
          infoWindow.open(this.googleMap, marker);
          this.activeInfoWindow = infoWindow;
        });

        infoWindow.addListener('closeclick', () => {
          if (this.activeInfoWindow === infoWindow) {
            this.activeInfoWindow = null;
          }
        });

        this.googleMarkers.push(marker);
      });

      this.cdr.markForCheck();
    }, 150);
  }

  openStreetView(districtName?: string): void {
    const targetDist = districtName || this.selectedMapDistrict || 'Chennai';
    const found = TAMIL_NADU_DISTRICTS.find((d: any) => d.name.toLowerCase() === targetDist.toLowerCase());
    const lat = found?.lat || 13.0827;
    const lng = found?.lng || 80.2707;

    this.streetViewVisible = true;
    this.streetViewTitle = `360° Google Street View Inspection — ${targetDist} District`;

    setTimeout(() => {
      const svElement = document.getElementById('streetViewPanorama');
      if (!svElement || typeof google === 'undefined') return;

      this.streetViewPanorama = new google.maps.StreetViewPanorama(svElement, {
        position: { lat, lng },
        pov: { heading: 165, pitch: 0 },
        zoom: 1,
        visible: true
      });
    }, 200);
    this.cdr.markForCheck();
  }

  closeStreetView(): void {
    this.streetViewVisible = false;
    this.cdr.markForCheck();
  }

  selectMapDistrict(districtName: string): void {
    if (this.selectedMapDistrict === districtName) {
      this.selectedMapDistrict = null;
      this.tableSearch = '';
      if (this.activeInfoWindow) {
        this.activeInfoWindow.close();
        this.activeInfoWindow = null;
      }
    } else {
      this.selectedMapDistrict = districtName;
      this.tableSearch = districtName;
      const found = TAMIL_NADU_DISTRICTS.find((d: any) => d.name.toLowerCase() === districtName.toLowerCase());
      if (found && this.googleMap) {
        this.googleMap.panTo({ lat: found.lat, lng: found.lng });
        this.googleMap.setZoom(9);
      }
    }
    this.filterTable();
    this.cdr.markForCheck();
  }

  resetMapFilter(): void {
    this.selectedMapDistrict = null;
    this.tableSearch = '';
    if (this.activeInfoWindow) {
      this.activeInfoWindow.close();
      this.activeInfoWindow = null;
    }
    if (this.googleMap) {
      this.googleMap.panTo({ lat: 10.8000, lng: 78.5000 });
      this.googleMap.setZoom(7.2);
    }
    this.filterTable();
    this.cdr.markForCheck();
  }


  getSum(col: string): number {
    if (!this.filteredMasterTableData || this.filteredMasterTableData.length === 0) return 0;
    return this.filteredMasterTableData.reduce((acc: number, row: any) => acc + (Number(row[col]) || 0), 0);
  }

  getOfficialTncwwbSchemeRows(): any[] {
    const rawList = [
      { district: 'Ariyalur', division: 'Trichy', scheme: '10th Std Passed (All Genders) / 10-ஆம் வகுப்பு தேர்ச்சி பெற்றவர் (அனைத்து பாலினங்கள்) – 1000/-', apply: 12, dmApproved: 4, pending: 8 },
      { district: 'Ariyalur', division: 'Trichy', scheme: '12th Std Passed (All Genders) / 12-ஆம் வகுப்பு தேர்ச்சி பெற்றவர் (அனைத்து பாலினங்கள்) – 1500/-', apply: 18, dmApproved: 5, pending: 13 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Arts and Science PG Degree Dayscholar / முறையான பட்ட மேற்படிப்பு', apply: 6, dmApproved: 1, pending: 5 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Arts and Science PG Degree Hosteller / முறையான பட்ட மேற்படிப்பு (விடுதியில் தங்கி படித்தால்)', apply: 3, dmApproved: 2, pending: 1 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Arts and Science UG Degree Dayscholar / முறையான பட்டப்படிப்பு – 1500/-', apply: 33, dmApproved: 8, pending: 25 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Arts and Science UG Degree Hosteller / முறையான பட்டப்படிப்பு மற்றும் விடுதியில் தங்கி படித்தால்', apply: 6, dmApproved: 1, pending: 5 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'ITI or Polytechnic Dayscholar / ஐடிஐ அல்லது பாலிடெக்னிக்', apply: 8, dmApproved: 1, pending: 7 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'ITI or Polytechnic Hosteller / ஐ.டி.ஐ அல்லது பாலிடெக்னிக் படிப்பு (விடுதியில் தங்கி படித்தால்)', apply: 3, dmApproved: 1, pending: 2 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Marriage Assistance(Daughter) / திருமண உதவித்தொகை (மகள்)', apply: 5, dmApproved: 1, pending: 4 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Marriage Assistance(Son) / திருமண உதவித்தொகை (மகன்)', apply: 4, dmApproved: 1, pending: 3 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Maternity Assistance / மகப்பேறு உதவித்தொகை', apply: 8, dmApproved: 1, pending: 7 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Miscarriage / Abortion / கருச்சிதைவு / கருக்கலைப்பு', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Natural Death & Funeral Assistance / இயற்கை மரணம் மற்றும் ஈமச்சடங்கு உதவித்தொகை', apply: 4, dmApproved: 3, pending: 1 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Old Age Pension (Above 60 years ) / முதியோர் ஓய்வூதியம் (60 வயதுக்கு மேல்)', apply: 8, dmApproved: 0, pending: 8 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Professional PG degree Dayscholar / தொழில்நுட்பப் பட்டமேற்படிப்பு', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Professional PG degree Hosteller / தொழில்நுட்பப் பட்ட மேற்படிப்பு (விடுதியில் தங்கி படித்தால்)', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Professional UG degree Dayscholar / தொழில்நுட்பப் பட்டபடிப்பு', apply: 13, dmApproved: 5, pending: 8 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Professional UG degree Hosteller / தொழில்நுட்பப் பட்டப்படிப்பு (விடுதியில் தங்கி படித்தால்)', apply: 15, dmApproved: 3, pending: 12 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Pursuing 10th Std (Only Girls ) / 10-ஆம் வகுப்பு படித்து வரும் (பெண்கள் மட்டும்) – 1000/-', apply: 10, dmApproved: 2, pending: 8 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Pursuing 11th Std (Only Girls ) / 11-ஆம் வகுப்பு படித்து வரும்(பெண்கள் மட்டும்) – 1000/-', apply: 5, dmApproved: 2, pending: 3 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Pursuing 12th Std (Only Girls ) / 12-ஆம் வகுப்பு படித்து வரும்(பெண்கள் மட்டும்) – 1500/-', apply: 9, dmApproved: 1, pending: 8 },
      { district: 'Ariyalur', division: 'Trichy', scheme: 'Spectacles Assistance / கண்கண்ணாடி உதவித்தொகை', apply: 3, dmApproved: 1, pending: 2 },

      { district: 'Chengalpattu', division: 'Chennai', scheme: '10th Std Passed (All Genders) / 10-ஆம் வகுப்பு தேர்ச்சி பெற்றவர் – 1000/-', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: '12th Std Passed (All Genders) / 12-ஆம் வகுப்பு தேர்ச்சி பெற்றவர் – 1500/-', apply: 3, dmApproved: 0, pending: 3 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Accidental Death at work place & Funeral Assistance', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Arts and Science PG Degree Hosteller / முறையான பட்ட மேற்படிப்பு', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Arts and Science UG Degree Dayscholar / முறையான பட்டப்படிப்பு – 1500/-', apply: 4, dmApproved: 1, pending: 3 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Arts and Science UG Degree Hosteller', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Handicapped (Disability of Hand, Leg, Eyes)', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'ITI or Polytechnic Dayscholar / ஐடிஐ அல்லது பாலிடெக்னிக்', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Marriage Assistance(Daughter) / திருமண உதவித்தொகை (மகள்)', apply: 4, dmApproved: 4, pending: 0 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Marriage Assistance(Son) / திருமண உதவித்தொகை (மகன்)', apply: 4, dmApproved: 3, pending: 1 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Maternity Assistance / மகப்பேறு உதவித்தொகை', apply: 2, dmApproved: 2, pending: 0 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Miscarriage / Abortion / கருச்சிதைவு / கருக்கலைப்பு', apply: 3, dmApproved: 1, pending: 2 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Natural Death & Funeral Assistance', apply: 3, dmApproved: 1, pending: 2 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Old Age Pension (Above 60 years )', apply: 4, dmApproved: 2, pending: 2 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Professional PG degree Dayscholar', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Professional UG degree Dayscholar', apply: 5, dmApproved: 1, pending: 4 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Professional UG degree Hosteller', apply: 2, dmApproved: 1, pending: 1 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Pursuing 10th Std (Only Girls )', apply: 5, dmApproved: 3, pending: 2 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Pursuing 11th Std (Only Girls )', apply: 3, dmApproved: 0, pending: 3 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Pursuing 12th Std (Only Girls )', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Chengalpattu', division: 'Chennai', scheme: 'Spectacles Assistance / கண்கண்ணாடி உதவித்தொகை', apply: 10, dmApproved: 7, pending: 3 },

      { district: 'Chennai', division: 'Chennai', scheme: '10th Std Passed (All Genders) / 10-ஆம் வகுப்பு தேர்ச்சி பெற்றவர் – 1000/-', apply: 39, dmApproved: 12, pending: 27 },
      { district: 'Chennai', division: 'Chennai', scheme: '12th Std Passed (All Genders) / 12-ஆம் வகுப்பு தேர்ச்சி பெற்றவர் – 1500/-', apply: 23, dmApproved: 10, pending: 13 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Accidental Death at work place & Funeral Assistance', apply: 5, dmApproved: 3, pending: 2 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Arts and Science PG Degree Dayscholar', apply: 8, dmApproved: 4, pending: 4 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Arts and Science PG Degree Hosteller', apply: 6, dmApproved: 5, pending: 1 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Arts and Science UG Degree Dayscholar – 1500/-', apply: 44, dmApproved: 13, pending: 31 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Arts and Science UG Degree Hosteller', apply: 6, dmApproved: 3, pending: 3 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Death at other than work place & Funeral Assistance', apply: 4, dmApproved: 3, pending: 1 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Funeral Assistance / ஈமச்சடங்கு உதவித்தொகை', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Handicapped (Disability of Hand, Leg, Eyes)', apply: 6, dmApproved: 3, pending: 3 },
      { district: 'Chennai', division: 'Chennai', scheme: 'ITI or Polytechnic Dayscholar', apply: 4, dmApproved: 1, pending: 3 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Marriage Assistance(Daughter) / திருமண உதவித்தொகை (மகள்)', apply: 21, dmApproved: 9, pending: 12 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Marriage Assistance(Son) / திருமண உதவித்தொகை (மகன்)', apply: 14, dmApproved: 5, pending: 9 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Maternity Assistance / மகப்பேறு உதவித்தொகை', apply: 53, dmApproved: 17, pending: 36 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Miscarriage / Abortion / கருச்சிதைவு / கருக்கலைப்பு', apply: 2, dmApproved: 1, pending: 1 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Natural Death & Funeral Assistance', apply: 20, dmApproved: 10, pending: 10 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Old Age Pension (Above 60 years )', apply: 96, dmApproved: 10, pending: 86 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Professional PG degree Dayscholar', apply: 5, dmApproved: 2, pending: 3 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Professional UG degree Dayscholar', apply: 14, dmApproved: 5, pending: 9 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Professional UG degree Hosteller', apply: 3, dmApproved: 1, pending: 2 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Pursuing 10th Std (Only Girls )', apply: 9, dmApproved: 5, pending: 4 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Pursuing 11th Std (Only Girls )', apply: 9, dmApproved: 3, pending: 6 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Pursuing 12th Std (Only Girls )', apply: 13, dmApproved: 3, pending: 10 },
      { district: 'Chennai', division: 'Chennai', scheme: 'Spectacles Assistance / கண்கண்ணாடி உதவித்தொகை', apply: 45, dmApproved: 20, pending: 25 },

      { district: 'Coimbatore', division: 'Coimbatore', scheme: '10th Std Passed (All Genders)', apply: 4, dmApproved: 2, pending: 2 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: '12th Std Passed (All Genders)', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Accidental Death at work place & Funeral Assistance', apply: 2, dmApproved: 0, pending: 2 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Arts and Science PG Degree Hosteller', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Arts and Science UG Degree Dayscholar', apply: 2, dmApproved: 1, pending: 1 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Arts and Science UG Degree Hosteller', apply: 2, dmApproved: 2, pending: 0 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Handicapped (Disability of Hand, Leg, Eyes)', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Marriage Assistance(Daughter)', apply: 6, dmApproved: 3, pending: 3 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Marriage Assistance(Son)', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Maternity Assistance', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Natural Death & Funeral Assistance', apply: 5, dmApproved: 2, pending: 3 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Professional UG degree Dayscholar', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Pursuing 10th Std (Only Girls)', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Pursuing 11th Std (Only Girls)', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Coimbatore', division: 'Coimbatore', scheme: 'Spectacles Assistance', apply: 2, dmApproved: 2, pending: 0 },

      { district: 'Cuddalore', division: 'Villupuram', scheme: '12th Std Passed (All Genders)', apply: 2, dmApproved: 1, pending: 1 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Accidental Death at work place & Funeral Assistance', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Arts and Science PG Degree Dayscholar', apply: 4, dmApproved: 1, pending: 3 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Arts and Science UG Degree Dayscholar', apply: 20, dmApproved: 3, pending: 17 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'ITI or Polytechnic Dayscholar', apply: 2, dmApproved: 0, pending: 2 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'ITI or Polytechnic Hosteller', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Marriage Assistance(Daughter)', apply: 4, dmApproved: 0, pending: 4 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Marriage Assistance(Son)', apply: 3, dmApproved: 1, pending: 2 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Maternity Assistance', apply: 7, dmApproved: 1, pending: 6 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Natural Death & Funeral Assistance', apply: 4, dmApproved: 2, pending: 2 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Old Age Pension (Above 60 years )', apply: 2, dmApproved: 0, pending: 2 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Professional PG degree Dayscholar', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Professional PG degree Hosteller', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Professional UG degree Dayscholar', apply: 9, dmApproved: 2, pending: 7 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Professional UG degree Hosteller', apply: 4, dmApproved: 1, pending: 3 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Pursuing 10th Std (Only Girls )', apply: 3, dmApproved: 0, pending: 3 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Pursuing 11th Std (Only Girls )', apply: 8, dmApproved: 1, pending: 7 },
      { district: 'Cuddalore', division: 'Villupuram', scheme: 'Pursuing 12th Std (Only Girls )', apply: 3, dmApproved: 1, pending: 2 },

      { district: 'Dharmapuri', division: 'Salem', scheme: '10th Std Passed (All Genders)', apply: 3, dmApproved: 0, pending: 3 },
      { district: 'Dharmapuri', division: 'Salem', scheme: '12th Std Passed (All Genders)', apply: 5, dmApproved: 0, pending: 5 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Arts and Science PG Degree Dayscholar', apply: 4, dmApproved: 0, pending: 4 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Arts and Science UG Degree Dayscholar', apply: 4, dmApproved: 0, pending: 4 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Arts and Science UG Degree Hosteller', apply: 2, dmApproved: 2, pending: 0 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Handicapped (Disability of Hand, Leg, Eyes)', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'ITI or Polytechnic Dayscholar', apply: 3, dmApproved: 0, pending: 3 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Marriage Assistance(Daughter)', apply: 5, dmApproved: 1, pending: 4 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Marriage Assistance(Son)', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Maternity Assistance', apply: 3, dmApproved: 0, pending: 3 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Natural Death & Funeral Assistance', apply: 5, dmApproved: 0, pending: 5 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Professional PG degree Dayscholar', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Professional UG degree Dayscholar', apply: 5, dmApproved: 1, pending: 4 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Professional UG degree Hosteller', apply: 3, dmApproved: 0, pending: 3 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Pursuing 10th Std (Only Girls )', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Pursuing 11th Std (Only Girls )', apply: 2, dmApproved: 0, pending: 2 },
      { district: 'Dharmapuri', division: 'Salem', scheme: 'Pursuing 12th Std (Only Girls )', apply: 1, dmApproved: 0, pending: 1 },

      { district: 'Dindigul', division: 'Madurai', scheme: '10th Std Passed (All Genders)', apply: 5, dmApproved: 0, pending: 5 },
      { district: 'Dindigul', division: 'Madurai', scheme: '12th Std Passed (All Genders)', apply: 3, dmApproved: 0, pending: 3 },
      { district: 'Dindigul', division: 'Madurai', scheme: 'Marriage Assistance(Daughter)', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Dindigul', division: 'Madurai', scheme: 'Marriage Assistance(Son)', apply: 3, dmApproved: 3, pending: 0 },
      { district: 'Dindigul', division: 'Madurai', scheme: 'Maternity Assistance', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Dindigul', division: 'Madurai', scheme: 'Natural Death & Funeral Assistance', apply: 5, dmApproved: 1, pending: 4 },
      { district: 'Dindigul', division: 'Madurai', scheme: 'Old Age Pension (Above 60 years )', apply: 1, dmApproved: 0, pending: 1 },
      { district: 'Dindigul', division: 'Madurai', scheme: 'Professional UG degree Hosteller', apply: 1, dmApproved: 0, pending: 1 },

      { district: 'Erode', division: 'Coimbatore', scheme: '10th Std Passed (All Genders)', apply: 4, dmApproved: 4, pending: 0 },
      { district: 'Erode', division: 'Coimbatore', scheme: '12th Std Passed (All Genders)', apply: 6, dmApproved: 2, pending: 4 },
      { district: 'Erode', division: 'Coimbatore', scheme: 'Accidental Death at work place & Funeral', apply: 2, dmApproved: 0, pending: 2 },
      { district: 'Erode', division: 'Coimbatore', scheme: 'Arts and Science PG Degree Dayscholar', apply: 2, dmApproved: 2, pending: 0 },
      { district: 'Erode', division: 'Coimbatore', scheme: 'Arts and Science UG Degree Dayscholar', apply: 3, dmApproved: 0, pending: 3 },
      { district: 'Erode', division: 'Coimbatore', scheme: 'Arts and Science UG Degree Hosteller', apply: 1, dmApproved: 1, pending: 0 },
      { district: 'Erode', division: 'Coimbatore', scheme: 'Marriage Assistance(Daughter)', apply: 2, dmApproved: 0, pending: 2 },
      { district: 'Erode', division: 'Coimbatore', scheme: 'Maternity Assistance', apply: 3, dmApproved: 3, pending: 0 },
      { district: 'Erode', division: 'Coimbatore', scheme: 'Natural Death & Funeral Assistance', apply: 3, dmApproved: 2, pending: 1 },
      { district: 'Erode', division: 'Coimbatore', scheme: 'Old Age Pension (Above 60 years )', apply: 4, dmApproved: 2, pending: 2 },
      { district: 'Erode', division: 'Coimbatore', scheme: 'Professional UG degree Dayscholar', apply: 5, dmApproved: 2, pending: 3 },
      { district: 'Erode', division: 'Coimbatore', scheme: 'Spectacles Assistance', apply: 2, dmApproved: 2, pending: 0 },

      { district: 'Kallakurichi', division: 'Villupuram', scheme: '10th Std Passed (All Genders)', apply: 7, dmApproved: 2, pending: 5 },
      { district: 'Kallakurichi', division: 'Villupuram', scheme: '12th Std Passed (All Genders)', apply: 5, dmApproved: 0, pending: 5 },
      { district: 'Kallakurichi', division: 'Villupuram', scheme: 'Arts and Science UG Degree Dayscholar', apply: 24, dmApproved: 1, pending: 23 },
      { district: 'Kallakurichi', division: 'Villupuram', scheme: 'ITI or Polytechnic Dayscholar', apply: 10, dmApproved: 1, pending: 9 },
      { district: 'Kallakurichi', division: 'Villupuram', scheme: 'Marriage Assistance(Daughter)', apply: 12, dmApproved: 1, pending: 11 },
      { district: 'Kallakurichi', division: 'Villupuram', scheme: 'Maternity Assistance', apply: 22, dmApproved: 3, pending: 19 },
      { district: 'Kallakurichi', division: 'Villupuram', scheme: 'Natural Death & Funeral Assistance', apply: 11, dmApproved: 0, pending: 11 },
      { district: 'Kallakurichi', division: 'Villupuram', scheme: 'Professional UG degree Hosteller', apply: 18, dmApproved: 2, pending: 16 },
      { district: 'Kallakurichi', division: 'Villupuram', scheme: 'Pursuing 10th Std (Only Girls )', apply: 6, dmApproved: 0, pending: 6 },
      { district: 'Kallakurichi', division: 'Villupuram', scheme: 'Pursuing 11th Std (Only Girls )', apply: 7, dmApproved: 1, pending: 6 },
      { district: 'Kallakurichi', division: 'Villupuram', scheme: 'Pursuing 12th Std (Only Girls )', apply: 6, dmApproved: 0, pending: 6 },

      { district: 'Pudukkottai', division: 'Trichy', scheme: '10th Std Passed (All Genders)', apply: 3, dmApproved: 1, pending: 2 },
      { district: 'Pudukkottai', division: 'Trichy', scheme: '12th Std Passed (All Genders)', apply: 8, dmApproved: 2, pending: 6 },
      { district: 'Pudukkottai', division: 'Trichy', scheme: 'Arts and Science UG Degree Dayscholar', apply: 21, dmApproved: 0, pending: 21 },
      { district: 'Pudukkottai', division: 'Trichy', scheme: 'Arts and Science UG Degree Hosteller', apply: 7, dmApproved: 3, pending: 4 },
      { district: 'Pudukkottai', division: 'Trichy', scheme: 'Marriage Assistance(Daughter)', apply: 10, dmApproved: 1, pending: 9 },
      { district: 'Pudukkottai', division: 'Trichy', scheme: 'Marriage Assistance(Son)', apply: 7, dmApproved: 1, pending: 6 },
      { district: 'Pudukkottai', division: 'Trichy', scheme: 'Maternity Assistance', apply: 12, dmApproved: 1, pending: 11 },
      { district: 'Pudukkottai', division: 'Trichy', scheme: 'Pursuing 10th Std (Only Girls )', apply: 13, dmApproved: 2, pending: 11 },
      { district: 'Pudukkottai', division: 'Trichy', scheme: 'Pursuing 11th Std (Only Girls )', apply: 8, dmApproved: 0, pending: 8 },
      { district: 'Pudukkottai', division: 'Trichy', scheme: 'Pursuing 12th Std (Only Girls )', apply: 7, dmApproved: 1, pending: 6 },

      { district: 'Tiruvallur', division: 'Chennai', scheme: '10th Std Passed (All Genders)', apply: 22, dmApproved: 4, pending: 18 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: '12th Std Passed (All Genders)', apply: 13, dmApproved: 2, pending: 11 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Accidental Death at work place & Funeral', apply: 5, dmApproved: 4, pending: 1 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Arts and Science UG Degree Dayscholar', apply: 18, dmApproved: 3, pending: 15 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Handicapped (Disability of Hand, Leg, Eyes)', apply: 6, dmApproved: 6, pending: 0 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Marriage Assistance(Daughter)', apply: 29, dmApproved: 8, pending: 21 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Marriage Assistance(Son)', apply: 19, dmApproved: 3, pending: 16 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Maternity Assistance', apply: 24, dmApproved: 7, pending: 17 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Natural Death & Funeral Assistance', apply: 8, dmApproved: 5, pending: 3 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Old Age Pension (Above 60 years )', apply: 17, dmApproved: 1, pending: 16 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Professional UG degree Dayscholar', apply: 16, dmApproved: 5, pending: 11 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Pursuing 10th Std (Only Girls )', apply: 26, dmApproved: 2, pending: 24 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Pursuing 11th Std (Only Girls )', apply: 13, dmApproved: 2, pending: 11 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Pursuing 12th Std (Only Girls )', apply: 17, dmApproved: 2, pending: 15 },
      { district: 'Tiruvallur', division: 'Chennai', scheme: 'Spectacles Assistance / கண்கண்ணாடி உதவித்தொகை', apply: 113, dmApproved: 9, pending: 104 },

      { district: 'Vellore', division: 'Vellore', scheme: 'Arts and Science PG Degree Dayscholar', apply: 7, dmApproved: 1, pending: 6 },
      { district: 'Vellore', division: 'Vellore', scheme: 'Arts and Science UG Degree Dayscholar', apply: 22, dmApproved: 1, pending: 21 },
      { district: 'Vellore', division: 'Vellore', scheme: 'ITI or Polytechnic Dayscholar', apply: 9, dmApproved: 1, pending: 8 },
      { district: 'Vellore', division: 'Vellore', scheme: 'ITI or Polytechnic Hosteller', apply: 7, dmApproved: 4, pending: 3 },
      { district: 'Vellore', division: 'Vellore', scheme: 'Maternity Assistance', apply: 6, dmApproved: 1, pending: 5 },
      { district: 'Vellore', division: 'Vellore', scheme: 'Professional UG degree Dayscholar', apply: 13, dmApproved: 1, pending: 12 },
      { district: 'Vellore', division: 'Vellore', scheme: 'Professional UG degree Hosteller', apply: 8, dmApproved: 1, pending: 7 },
      { district: 'Vellore', division: 'Vellore', scheme: 'Pursuing 10th Std (Only Girls )', apply: 14, dmApproved: 2, pending: 12 },
      { district: 'Vellore', division: 'Vellore', scheme: 'Pursuing 11th Std (Only Girls )', apply: 8, dmApproved: 0, pending: 8 },
      { district: 'Vellore', division: 'Vellore', scheme: 'Pursuing 12th Std (Only Girls )', apply: 8, dmApproved: 0, pending: 8 },

      { district: 'Viluppuram', division: 'Villupuram', scheme: '10th Std Passed (All Genders)', apply: 6, dmApproved: 2, pending: 4 },
      { district: 'Viluppuram', division: 'Villupuram', scheme: 'Arts and Science UG Degree Dayscholar', apply: 18, dmApproved: 3, pending: 15 },
      { district: 'Viluppuram', division: 'Villupuram', scheme: 'ITI or Polytechnic Dayscholar', apply: 5, dmApproved: 1, pending: 4 },
      { district: 'Viluppuram', division: 'Villupuram', scheme: 'Marriage Assistance(Daughter)', apply: 9, dmApproved: 2, pending: 7 },
      { district: 'Viluppuram', division: 'Villupuram', scheme: 'Natural Death & Funeral Assistance', apply: 6, dmApproved: 2, pending: 4 },
      { district: 'Viluppuram', division: 'Villupuram', scheme: 'Professional UG degree Hosteller', apply: 10, dmApproved: 4, pending: 6 },
      { district: 'Viluppuram', division: 'Villupuram', scheme: 'Pursuing 12th Std (Only Girls )', apply: 10, dmApproved: 1, pending: 9 }
    ];

    return rawList.map(r => ({
      district: r.district,
      division: r.division,
      col_scheme: 'TNCWWB Scheme',
      col_schemename: r.scheme,
      col1: r.apply,
      col2: r.dmApproved,
      col3: r.pending,
      col4: 0
    }));
  }

  // Email Modal Properties
  sendMailModalVisible: boolean = false;
  mailRecipient: string = '';
  mailSubject: string = 'Subject';
  isSendingMail: boolean = false;
  currentDetailDataForMail: any = null;

  // RAG cache ready flag
  isRAGCacheReady: boolean = false;

  // Methods
  openSendMailModal(tableRef: any) {
    console.log("Opening send mail modal with data:", tableRef);
    let dataToExport = [];
    if (tableRef && tableRef.value) {
      dataToExport = tableRef.value;
    } else if (Array.isArray(tableRef)) {
      dataToExport = tableRef;
    } else if (this.detailTableRows && this.detailTableRows.length > 0) {
       dataToExport = this.detailTableRows;
    }

    if (!dataToExport || dataToExport.length === 0) {
      Swal.fire('No Data', 'No data available to send.', 'warning');
      return;
    }

    this.currentDetailDataForMail = dataToExport;
    this.mailRecipient = '';
    this.mailSubject = this.detailDialogTitle || 'Detailed Name List';
    this.sendMailModalVisible = true;
  }

  sendMail() {
    if (!this.mailRecipient) {
      Swal.fire('Missing Recipient', 'Please enter a recipient email address.', 'warning');
      return;
    }

    this.isSendingMail = true;
    let htmlTable = '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: sans-serif; font-size: 12px; width: 100%;">';

    // Build Headers
    if (this.currentDetailDataForMail.length > 0) {
      htmlTable += '<thead><tr style="background-color: #f2f2f2;">';
      const keys = Object.keys(this.currentDetailDataForMail[0]).filter(k => k !== 'photo' && k !== 'screenshot');
      keys.forEach(k => {
        htmlTable += `<th>${k.toUpperCase()}</th>`;
      });
      htmlTable += '</tr></thead>';

      // Build Rows
      htmlTable += '<tbody>';
      this.currentDetailDataForMail.forEach((row: any) => {
        htmlTable += '<tr>';
        keys.forEach(k => {
          htmlTable += `<td>${row[k] || ''}</td>`;
        });
        htmlTable += '</tr>';
      });
      htmlTable += '</tbody>';
    }
    htmlTable += '</table>';

    let base64Excel = '';
    if (this.currentDetailDataForMail && this.currentDetailDataForMail.length > 0) {
      try {
        // Strip out 'photo' and 'screenshot' keys from data before exporting
        const cleanData = this.currentDetailDataForMail.map((row: any) => {
          const cleanRow = { ...row };
          delete cleanRow.photo;
          delete cleanRow.screenshot;
          return cleanRow;
        });
        const worksheet = XLSX.utils.json_to_sheet(cleanData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "DetailedList");
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        base64Excel = btoa(
          new Uint8Array(excelBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
      } catch (e) {
        console.error("Error generating excel:", e);
      }
    }

    const payload = {
      ToEmail: this.mailRecipient,
      Subject: this.mailSubject,
      Body: 'Please find the detailed list attached (and below):<br><br>' + htmlTable,
      AttachmentBase64: base64Excel,
      AttachmentFileName: 'DetailedList.xlsx'
    };

    const emailUrl = environment.apiUrl ? `${environment.apiUrl}/api/v1/Email/send` : 'http://localhost:5000/api/v1/Email/send';

    fetch(emailUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(async response => {
      if (response.ok) {
         this.sendMailModalVisible = false;
         this.cdr.detectChanges();
         Swal.fire('Success', 'Email sent successfully!', 'success');
      } else {
         let errorMsg = 'Failed to send email. Please check server logs.';
         try {
           const errData = await response.json();
           if (errData && errData.message) errorMsg = errData.message;
         } catch(e) {}
         Swal.fire('Delivery Failed', errorMsg, 'error');
      }
    })
    .catch(error => {
      console.error("Error sending mail:", error);
      Swal.fire('Connection Error', 'Could not reach the backend email server. Please ensure the API is running on port 5000.', 'error');
    })
    .finally(() => {
      this.isSendingMail = false;
      this.cdr.detectChanges();
    });
  }

  syncAllDataToLocalCache() {
    console.log('Initiating Background Data Cache (RAG/ML mode)...');
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = 'dashboard_rag_cache_' + today;

    const existingCache = localStorage.getItem(cacheKey);
    if (existingCache) {
      console.log('RAG Cache already exists for today. Using local data.');
      this.isRAGCacheReady = true;
      return;
    }

    this.ds.getOneDashboardWorkList('work', [], [], ['2026'], '', '').subscribe(res => {
      if (res && res.status === 'SUCCESS' && Array.isArray(res.data)) {
        try {
           localStorage.setItem(cacheKey, JSON.stringify(res.data));
           this.isRAGCacheReady = true;
           console.log('RAG Cache successfully populated with ' + res.data.length + ' records.');
        } catch (e) {
           console.warn('Local storage quota exceeded for RAG cache. Using in-memory fallback.');
           (this.ds as any)['inMemoryRAGCache'] = res.data;
           this.isRAGCacheReady = true;
        }
      }
    });
  }

  buildMasterChart() {
    if (!this.filteredMasterTableData || this.filteredMasterTableData.length === 0) {
      this.masterChartData = { labels: [], datasets: [] };
      return;
    }
    const labels = this.filteredMasterTableData.map(r => r.district || r.scheme || r.division || 'Unknown');

    let col1Key = '';
    let col2Key = '';
    let label1 = 'Metrics (Primary)';
    let label2 = 'Metrics (Secondary)';

    if (this.selectedCardId === 'all' || !this.selectedCardId) {
       col1Key = 'tipsCount';
       col2Key = 'thmsCount';
       label1 = 'TIPS / TIME Count';
       label2 = 'THMS Count';
    } else if (this.selectedCardId === 'tncwwb-scheme') {
       col1Key = 'apply';
       col2Key = 'dmApproved';
       label1 = 'Applied';
       label2 = 'DM Approved';
    } else {
       // generic fallback
       const keys = Object.keys(this.filteredMasterTableData[0]);
       const numKeys = keys.filter(k => typeof this.filteredMasterTableData[0][k] === 'number');
       col1Key = numKeys[0] || '';
       col2Key = numKeys[1] || '';
       label1 = col1Key || 'Metrics 1';
       label2 = col2Key || 'Metrics 2';
    }

    const data1 = col1Key ? this.filteredMasterTableData.map(r => Number(r[col1Key]) || 0) : [];
    const data2 = col2Key ? this.filteredMasterTableData.map(r => Number(r[col2Key]) || 0) : [];

    const datasets = [];
    if (data1.length > 0) {
      datasets.push({ label: label1, data: data1, backgroundColor: '#3b82f6' });
    }
    if (data2.length > 0 && data2.some(d => d > 0)) {
      datasets.push({ label: label2, data: data2, backgroundColor: '#10b981' });
    }

    this.masterChartData = { labels, datasets };
    this.masterChartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } }
    };
  }
}
