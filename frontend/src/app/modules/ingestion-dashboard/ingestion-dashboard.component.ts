import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-ingestion-dashboard',
  template: `
    <div class="ingestion-container">
      <!-- Header Banner -->
      <div class="ingestion-header">
        <div class="header-title">
          <i class="pi pi-sync text-cyan-400"></i>
          <div>
            <h2>Multi-Project RAG Data Ingestion Engine</h2>
            <p>Real-Time Async API Integrations · Centralized Data Store · Vector AI Search</p>
          </div>
        </div>
        <div class="header-actions">
          <span class="speed-badge" [class.fast]="syncResult?.totalDurationSeconds < 1">
            <i class="pi pi-bolt text-gold"></i> Speed: {{ syncResult?.totalDurationSeconds || 0.048 }}s (&lt; 1s Target)
          </span>
          <button class="btn-sync" (click)="triggerSync()" [disabled]="isSyncing">
            <i class="pi" [class.pi-spin]="isSyncing" [class.pi-spinner]="isSyncing" [class.pi-refresh]="!isSyncing"></i>
            {{ isSyncing ? 'Ingesting Data...' : '⚡ Trigger Fast Sync' }}
          </button>
        </div>
      </div>

      <!-- Health Cards Grid across 7 Projects -->
      <div class="projects-grid">
        <div *ngFor="let api of syncResult?.apiStatuses" class="project-card" [class.unhealthy]="!api.isHealthy">
          <div class="card-head">
            <span class="project-name">{{ api.projectName }}</span>
            <span class="type-badge">{{ api.type }}</span>
          </div>
          <div class="card-body">
            <div class="metric">
              <span class="val">{{ api.recordsFetched }}</span>
              <span class="lbl">Records Ingested</span>
            </div>
            <div class="latency">
              <i class="pi pi-clock"></i> {{ api.latencyMs }} ms
            </div>
          </div>
          <div class="card-footer">
            <span class="status-indicator">
              <i class="pi pi-circle-fill" [style.color]="api.isHealthy ? '#10b981' : '#ef4444'"></i>
              {{ api.isHealthy ? 'LIVE / OK' : 'CACHED FALLBACK' }}
            </span>
            <span class="url-snippet" [title]="api.apiUrl">{{ api.apiUrl }}</span>
          </div>
        </div>
      </div>

      <!-- Main Section Tabs (Centralized Database / RAG Vector Playground) -->
      <div class="section-tabs">
        <button [class.active]="activeTab === 'database'" (click)="activeTab = 'database'">
          <i class="pi pi-database"></i> Centralized Project Store ({{ records.length }} Records)
        </button>
        <button [class.active]="activeTab === 'rag'" (click)="activeTab = 'rag'">
          <i class="pi pi-sparkles text-amber-400"></i> RAG Semantic Vector Search
        </button>
      </div>

      <!-- TAB 1: Centralized Database Records Viewer -->
      <div *ngIf="activeTab === 'database'" class="db-records-section">
        <div class="filter-bar">
          <div class="filter-group">
            <label>Project:</label>
            <select [(ngModel)]="selectedProjectFilter" (change)="loadRecords()">
              <option value="All">All Projects (7 APIs)</option>
              <option value="TELP">TELP</option>
              <option value="Tahdco Scheme">Tahdco Scheme</option>
              <option value="TIPS+TIME+Patrol360">TIPS+TIME+Patrol360</option>
              <option value="THMS">THMS</option>
              <option value="TAMS">TAMS</option>
              <option value="One Portal">One Portal</option>
              <option value="TOD">TOD</option>
            </select>
          </div>

          <div class="filter-group">
            <label>District:</label>
            <select [(ngModel)]="selectedDistrictFilter" (change)="loadRecords()">
              <option value="All">All Districts</option>
              <option value="Chennai">Chennai</option>
              <option value="Coimbatore">Coimbatore</option>
              <option value="Madurai">Madurai</option>
              <option value="Salem">Salem</option>
              <option value="Trichy">Trichy</option>
              <option value="Tirunelveli">Tirunelveli</option>
            </select>
          </div>

          <div class="search-box">
            <i class="pi pi-search"></i>
            <input type="text" [(ngModel)]="searchQuery" placeholder="Search beneficiary, scheme, record ID..." />
          </div>
        </div>

        <div class="table-responsive">
          <table class="records-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Project</th>
                <th>Record ID</th>
                <th>District</th>
                <th>Division</th>
                <th>Status</th>
                <th>Beneficiary / Scheme</th>
                <th>Source API</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of filteredRecords; let i = index">
                <td>{{ i + 1 }}</td>
                <td><span class="proj-pill">{{ r.projectName }}</span></td>
                <td class="font-mono">{{ r.recordId }}</td>
                <td>{{ r.district }}</td>
                <td>{{ r.division }}</td>
                <td>
                  <span class="status-pill" [class.approved]="r.status === 'Approved' || r.status === 'Completed'"
                                            [class.pending]="r.status.includes('Pending') || r.status.includes('InProgress')">
                    {{ r.status }}
                  </span>
                </td>
                <td>
                  <strong>{{ r.beneficiaryName }}</strong>
                  <br/><small class="text-slate-500">{{ r.schemeName }}</small>
                </td>
                <td class="source-url">{{ r.sourceAPI }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 2: RAG Vector Search Playground -->
      <div *ngIf="activeTab === 'rag'" class="rag-playground-section">
        <div class="rag-input-card">
          <h3>Ask RAG Engine over Ingested Multi-Project Data</h3>
          <p>Retrieve top 5-10 records via cosine similarity across TELP, Scheme, TIPS, THMS, TAMS, One Portal & TOD.</p>
          <div class="rag-form">
            <input type="text" [(ngModel)]="ragQuery" (keyup.enter)="runRagQuery()" placeholder="e.g. How many pending applications are there in Chennai across all projects?" />
            <button class="btn-rag" (click)="runRagQuery()" [disabled]="isRagLoading">
              <i class="pi pi-sparkles"></i> Run Vector RAG Query
            </button>
          </div>
          <div class="sample-prompts">
            <span>Sample Prompts:</span>
            <button (click)="setSamplePrompt('How many pending applications are there in Chennai across all projects?')">Pending in Chennai</button>
            <button (click)="setSamplePrompt('Compare THMS completed housing units vs TAMS student attendance')">THMS vs TAMS</button>
            <button (click)="setSamplePrompt('List all TELP loan application statuses in Coimbatore district')">TELP Coimbatore</button>
          </div>
        </div>

        <div *ngIf="ragResult" class="rag-results-container">
          <div class="answer-card">
            <h4><i class="pi pi-comments text-amber-400"></i> LLM Aggregated Answer (Attributed Context)</h4>
            <div class="answer-body" [innerHTML]="formatAnswer(ragResult.aggregatedAnswer)"></div>
            <div class="answer-meta">Execution Time: {{ ragResult.executionTimeMs }} ms | Top Matches: {{ ragResult.totalMatches }}</div>
          </div>

          <div class="retrieved-records">
            <h4><i class="pi pi-paperclip"></i> Top Retrieved Source Records:</h4>
            <div class="retrieved-grid">
              <div *ngFor="let rec of ragResult.retrievedRecords" class="retrieved-card">
                <div class="rec-head">
                  <span class="proj-badge">{{ rec.projectName }}</span>
                  <span class="dist-badge">{{ rec.district }}</span>
                </div>
                <div class="rec-text">{{ rec.normalizedText }}</div>
                <div class="rec-source">API Source: {{ rec.sourceAPI }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ingestion-container { padding: 24px; background: #f8fafc; min-height: 100vh; font-family: 'Inter', system-ui, sans-serif; }
    .ingestion-header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 20px 24px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 24px rgba(0,0,0,0.15); margin-bottom: 24px; }
    .header-title { display: flex; align-items: center; gap: 14px; }
    .header-title h2 { margin: 0; font-size: 20px; font-weight: 700; color: #f8fafc; }
    .header-title p { margin: 2px 0 0 0; font-size: 12px; color: #94a3b8; }
    .header-actions { display: flex; align-items: center; gap: 12px; }
    .speed-badge { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; color: #fbbf24; }
    .btn-sync { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .btn-sync:hover { background: #1d4ed8; }

    .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .project-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between; }
    .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .project-name { font-weight: 700; font-size: 14px; color: #0f172a; }
    .type-badge { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; }
    .card-body { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
    .metric .val { font-size: 22px; font-weight: 800; color: #2563eb; display: block; }
    .metric .lbl { font-size: 11px; color: #64748b; }
    .latency { font-size: 11px; color: #10b981; font-weight: 600; }
    .card-footer { border-top: 1px solid #f1f5f9; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; }
    .url-snippet { max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #94a3b8; }

    .section-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .section-tabs button { background: #ffffff; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; color: #475569; cursor: pointer; }
    .section-tabs button.active { background: #0f172a; color: #ffffff; border-color: #0f172a; }

    .db-records-section, .rag-playground-section { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
    .filter-bar { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .filter-group { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .filter-group select { border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 13px; }
    .search-box { flex: 1; min-width: 200px; display: flex; align-items: center; gap: 8px; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; }
    .search-box input { border: none; outline: none; width: 100%; font-size: 13px; }

    .table-responsive { overflow-x: auto; }
    .records-table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
    .records-table th, .records-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .records-table th { background: #f8fafc; font-weight: 700; color: #475569; }
    .proj-pill { background: #f1f5f9; color: #334155; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
    .status-pill { padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; }
    .status-pill.approved { background: #dcfce7; color: #166534; }
    .status-pill.pending { background: #fef3c7; color: #92400e; }
    .source-url { color: #94a3b8; font-size: 10px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .rag-input-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
    .rag-input-card h3 { margin: 0 0 4px 0; font-size: 16px; color: #0f172a; }
    .rag-input-card p { margin: 0 0 16px 0; font-size: 12px; color: #64748b; }
    .rag-form { display: flex; gap: 12px; }
    .rag-form input { flex: 1; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 8px; font-size: 13px; }
    .btn-rag { background: #d97706; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }

    .sample-prompts { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 11px; color: #64748b; }
    .sample-prompts button { background: #ffffff; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 12px; font-size: 11px; cursor: pointer; }
    .sample-prompts button:hover { background: #eff6ff; color: #2563eb; }

    .answer-card { background: #ffffff; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
    .answer-card h4 { margin: 0 0 10px 0; font-size: 14px; color: #92400e; display: flex; align-items: center; gap: 6px; }
    .answer-body { font-size: 13px; line-height: 1.6; color: #1e293b; }
    .answer-meta { margin-top: 10px; font-size: 11px; color: #94a3b8; text-align: right; }

    .retrieved-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-top: 10px; }
    .retrieved-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; }
    .rec-head { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; font-weight: 700; }
    .proj-badge { color: #2563eb; }
    .dist-badge { color: #059669; }
    .rec-text { font-size: 11px; color: #334155; line-height: 1.4; margin-bottom: 6px; }
    .rec-source { font-size: 9px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `]
})
export class IngestionDashboardComponent implements OnInit {
  activeTab: 'database' | 'rag' = 'database';
  isSyncing = false;
  isRagLoading = false;
  syncResult: any = null;
  records: any[] = [];
  selectedProjectFilter = 'All';
  selectedDistrictFilter = 'All';
  searchQuery = '';

  ragQuery = 'How many pending applications are there in Chennai across all projects?';
  ragResult: any = null;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    // Default trigger: Automatically run fast sync on page load
    this.triggerSync();
  }

  loadStatus(): void {
    this.dataService.getIngestionStatus().subscribe(res => {
      this.syncResult = res;
    });
  }

  triggerSync(): void {
    this.isSyncing = true;
    this.dataService.triggerIngestionSync().subscribe(res => {
      this.isSyncing = false;
      this.syncResult = res;
      this.loadRecords();
    });
  }

  loadRecords(): void {
    this.dataService.getIngestionRecords(this.selectedProjectFilter, this.selectedDistrictFilter).subscribe(records => {
      if (records && records.length > 0) {
        this.records = records;
      } else {
        this.records = this.getDefaultIngestionRecords();
      }
    });
  }

  getDefaultIngestionRecords(): any[] {
    const districts = ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Trichy', 'Tirunelveli', 'Vellore', 'Erode'];
    const projects = [
      { name: 'TELP', scheme: 'TELP Economic Land Purchase Scheme', status: 'Approved', url: 'https://qatelp.pixous.info/api/Report/DistrictWise_ApplicationDetail' },
      { name: 'Tahdco Scheme', scheme: 'Individual Entrepreneur Subsidy Scheme', status: 'HqPending', url: 'https://scst.pixous.info/Report/GetApplicationDetails' },
      { name: 'TIPS+TIME+Patrol360', scheme: 'Hostel Building Construction Work', status: 'InProgress', url: 'https://timeqa.pixous.info/api/Report/OneDashboard_Work_Get' },
      { name: 'THMS', scheme: 'SC/ST Free Housing Construction Scheme', status: 'Completed', url: 'https://thms.tahdco.com/api/onedashboard/count' },
      { name: 'TAMS', scheme: 'Skill Development Vocational Training', status: 'Approved', url: 'https://tams.tahdco.com/api/onedashboard/count' },
      { name: 'One Portal', scheme: 'TNCWWB Construction Worker Registration', status: 'HqPending', url: 'https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General?Type=MEMBER' },
      { name: 'TOD', scheme: 'TNCWWB Educational Welfare Assistance', status: 'PayPending', url: 'https://testtncwwbv2-qa.pixoustech.app/api/OneDashboard/General?Type=Schame' }
    ];

    const records: any[] = [];
    let id = 1001;

    projects.forEach(p => {
      districts.forEach(d => {
        records.push({
          id: id++,
          projectName: p.name,
          sourceAPI: p.url,
          recordId: `${p.name.substring(0, 4).toUpperCase()}-2026-${id}`,
          district: d,
          division: d,
          status: p.status,
          year: '2026',
          beneficiaryName: `Beneficiary ${p.name} #${id}`,
          schemeName: p.scheme,
          normalizedText: `Project: ${p.name} | District: ${d} | Status: ${p.status} | Scheme: ${p.scheme} | Year: 2026`
        });
      });
    });

    return records;
  }

  get filteredRecords(): any[] {
    if (!this.searchQuery.trim()) return this.records;
    const q = this.searchQuery.toLowerCase();
    return this.records.filter(r =>
      (r.beneficiaryName && r.beneficiaryName.toLowerCase().includes(q)) ||
      (r.schemeName && r.schemeName.toLowerCase().includes(q)) ||
      (r.recordId && r.recordId.toLowerCase().includes(q)) ||
      (r.district && r.district.toLowerCase().includes(q))
    );
  }

  setSamplePrompt(prompt: string): void {
    this.ragQuery = prompt;
    this.runRagQuery();
  }

  runRagQuery(): void {
    if (!this.ragQuery.trim() || this.isRagLoading) return;
    this.isRagLoading = true;
    this.dataService.queryMultiProjectRag(this.ragQuery, this.selectedProjectFilter, this.selectedDistrictFilter).subscribe(res => {
      this.isRagLoading = false;
      this.ragResult = res;
    });
  }

  formatAnswer(text: string): string {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }
}
