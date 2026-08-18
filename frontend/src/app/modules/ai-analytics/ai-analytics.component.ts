import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-ai-analytics',
  template: `
    <div class="analytics-page">
      <div class="page-header">
        <div>
          <h2><i class="pi pi-chart-bar text-primary"></i> AI Engine & Observability Dashboard</h2>
          <p class="subtitle">Real-time token usage, latency metrics, provider costs, RAG search stats, and MCP tool execution logs</p>
        </div>
        <button class="btn-refresh" (click)="loadAnalytics()"><i class="pi pi-refresh"></i> Refresh Data</button>
      </div>

      <div class="kpi-grid" *ngIf="analytics">
        <div class="kpi-card">
          <div class="kpi-icon blue"><i class="pi pi-send"></i></div>
          <div class="kpi-info">
            <span class="kpi-label">Total AI Requests</span>
            <span class="kpi-value">{{ analytics.totalRequests }}</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon green"><i class="pi pi-database"></i></div>
          <div class="kpi-info">
            <span class="kpi-label">Total Tokens Processed</span>
            <span class="kpi-value">{{ analytics.totalTokens | number }}</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon orange"><i class="pi pi-dollar"></i></div>
          <div class="kpi-info">
            <span class="kpi-label">Estimated AI Cost</span>
            <span class="kpi-value">&#36;{{ analytics.totalCostUsd | number:'1.4-4' }}</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon purple"><i class="pi pi-clock"></i></div>
          <div class="kpi-info">
            <span class="kpi-label">Average Latency</span>
            <span class="kpi-value">{{ analytics.averageLatencyMs }} ms</span>
          </div>
        </div>
      </div>

      <div class="analytics-panels" *ngIf="analytics">
        <div class="panel">
          <h3><i class="pi pi-cloud"></i> Provider Distribution</h3>
          <div class="provider-list">
            <div *ngFor="let p of providerKeys" class="provider-item">
              <span class="p-name">{{ p }}</span>
              <span class="p-count">{{ analytics.requestsByProvider[p] }} requests</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3><i class="pi pi-list"></i> Active MCP Tools Catalog</h3>
          <div class="mcp-list">
            <div *ngFor="let tool of mcpTools" class="mcp-card">
              <div class="mcp-header">
                <strong>{{ tool.name }}</strong>
                <span class="category-chip">{{ tool.category }}</span>
              </div>
              <p>{{ tool.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .analytics-page { padding: 24px; background: #f8fafc; min-height: 100vh; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h2 { margin: 0; font-size: 22px; font-weight: 700; color: #0f172a; }
    .subtitle { margin: 4px 0 0; color: #64748b; font-size: 13px; }

    .btn-refresh {
      background: #2563eb; color: #fff; border: none; padding: 10px 18px;
      border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;
    }

    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card {
      background: #fff; border-radius: 12px; padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 16px;
    }
    .kpi-icon {
      width: 48px; height: 48px; border-radius: 12px; display: flex;
      align-items: center; justify-content: center; font-size: 20px;
    }
    .kpi-icon.blue { background: #eff6ff; color: #2563eb; }
    .kpi-icon.green { background: #f0fdf4; color: #16a34a; }
    .kpi-icon.orange { background: #fff7ed; color: #ea580c; }
    .kpi-icon.purple { background: #faf5ff; color: #9333ea; }

    .kpi-info { display: flex; flex-direction: column; }
    .kpi-label { font-size: 12px; color: #64748b; }
    .kpi-value { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 2px; }

    .analytics-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .panel { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .panel h3 { margin: 0 0 16px; font-size: 16px; color: #0f172a; display: flex; align-items: center; gap: 8px; }

    .provider-list { display: flex; flex-direction: column; gap: 10px; }
    .provider-item {
      display: flex; justify-content: space-between; padding: 12px 14px;
      background: #f8fafc; border-radius: 8px; font-size: 13px; font-weight: 600;
    }

    .mcp-list { display: flex; flex-direction: column; gap: 12px; }
    .mcp-card { background: #f8fafc; border-radius: 8px; padding: 12px 14px; }
    .mcp-header { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    .category-chip { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
    .mcp-card p { margin: 6px 0 0; font-size: 12px; color: #64748b; }
  `]
})
export class AiAnalyticsComponent implements OnInit {
  analytics: any = null;
  mcpTools: any[] = [];
  providerKeys: string[] = [];

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.dataService.getAiAnalytics().subscribe(res => {
      this.analytics = res;
      this.providerKeys = Object.keys(res.requestsByProvider || {});
    });

    this.dataService.getMcpTools().subscribe(tools => {
      this.mcpTools = tools;
    });
  }
}
