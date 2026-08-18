import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  provider?: string;
  model?: string;
  citations?: any[];
  actions?: string[];
  timestamp: Date;
}

@Component({
  selector: 'app-ai-assistant',
  template: `
    <!-- Floating AI Widget Button -->
    <button 
      class="ai-fab-btn" 
      (click)="toggleWidget()" 
      [title]="isOpen ? 'Close AI Assistant' : 'Open TAHDCO AI Copilot'">
      <i [class]="isOpen ? 'pi pi-times' : 'pi pi-sparkles'"></i>
      <span *ngIf="!isOpen" class="ai-fab-label">AI Copilot</span>
    </button>

    <!-- AI Drawer Chat Panel -->
    <div class="ai-drawer" [class.open]="isOpen">
      <div class="ai-drawer-header">
        <div class="ai-title">
          <i class="pi pi-sparkles text-gold"></i>
          <div>
            <h3>TAHDCO AI Copilot</h3>
            <span class="ai-subtitle">Multi-LLM · RAG Engine · MCP Tools</span>
          </div>
        </div>
        <div class="ai-header-controls">
          <select [(ngModel)]="selectedProvider" class="provider-select">
            <option value="Auto">Auto (Smart Provider)</option>
            <option value="OpenAI">OpenAI (GPT-4o)</option>
            <option value="Gemini">Google Gemini 1.5</option>
            <option value="Local">Local Engine (Ollama)</option>
          </select>
          <button class="btn-close" (click)="toggleWidget()"><i class="pi pi-times"></i></button>
        </div>
      </div>

      <div class="ai-drawer-body">
        <div class="quick-chips">
          <button (click)="quickPrompt('Execute MCP tool: tahdco_get_tncwwb_member_summary')">
            <i class="pi pi-user-plus text-blue-500"></i> TNCWWB Member MCP
          </button>
          <button (click)="quickPrompt('Execute MCP tool: tahdco_get_tncwwb_scheme_summary')">
            <i class="pi pi-wallet text-amber-500"></i> TNCWWB Scheme MCP
          </button>
          <button (click)="quickPrompt('Give an executive summary of TIPS civil works for FY 2025-26')">
            <i class="pi pi-briefcase"></i> Tender Audit
          </button>
          <button (click)="quickPrompt('Search G.O. guidelines for TELP land scheme eligibility')">
            <i class="pi pi-file-search"></i> Scheme RAG Search
          </button>
          <button (click)="quickPrompt('Show active MCP Tools catalog')">
            <i class="pi pi-cog"></i> MCP Catalog
          </button>
        </div>

        <div class="chat-messages">
          <div *ngFor="let msg of messages" class="chat-bubble" [class.user]="msg.sender === 'user'" [class.ai]="msg.sender === 'ai'">
            <div class="bubble-meta">
              <span class="sender-name">{{ msg.sender === 'user' ? 'You' : 'TAHDCO AI Assistant' }}</span>
              <span class="provider-badge" *ngIf="msg.provider">{{ msg.provider }}</span>
              <span class="time-stamp">{{ msg.timestamp | date:'shortTime' }}</span>
            </div>

            <div class="bubble-text" [innerHTML]="formatMarkdown(msg.text)"></div>

            <!-- RAG Citations Badge -->
            <div *ngIf="msg.citations && msg.citations.length > 0" class="citations-container">
              <span class="citations-title"><i class="pi pi-book"></i> RAG Document Citations:</span>
              <div *ngFor="let cit of msg.citations" class="citation-card">
                <strong>[{{ cit.category }}] {{ cit.documentTitle }}</strong>
                <p>{{ cit.excerpt }}</p>
              </div>
            </div>

            <!-- Action Suggestions Buttons -->
            <div *ngIf="msg.actions && msg.actions.length > 0" class="action-buttons">
              <button *ngFor="let act of msg.actions" (click)="executeSuggestedAction(act)">
                <i class="pi pi-bolt"></i> {{ act }}
              </button>
            </div>
          </div>

          <div *ngIf="isLoading" class="chat-bubble ai loading">
            <i class="pi pi-spin pi-spinner"></i> TAHDCO AI engine synthesizing insights...
          </div>
        </div>
      </div>

      <div class="ai-drawer-footer">
        <input 
          type="text" 
          [(ngModel)]="userInput" 
          (keyup.enter)="sendMessage()" 
          placeholder="Ask AI about tenders, housing, schemes, or G.O. documents..." 
          [disabled]="isLoading" />
        <button (click)="sendMessage()" [disabled]="isLoading || !userInput.trim()">
          <i class="pi pi-send"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ai-fab-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1000;
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: #fff;
      border: none;
      padding: 12px 20px;
      border-radius: 30px;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 8px 24px rgba(30,60,114,0.35);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
    }
    .ai-fab-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(30,60,114,0.45);
    }

    .ai-drawer {
      position: fixed;
      bottom: 84px;
      right: 24px;
      width: 440px;
      height: 600px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 100px);
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.22);
      z-index: 1001;
      display: flex;
      flex-direction: column;
      transform: translateY(20px) scale(0.95);
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ai-drawer.open {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: all;
    }

    .ai-drawer-header {
      padding: 16px 20px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #fff;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .ai-title { display: flex; align-items: center; gap: 12px; }
    .ai-title h3 { margin: 0; font-size: 16px; font-weight: 700; color: #f8fafc; }
    .ai-subtitle { font-size: 11px; color: #94a3b8; }
    .text-gold { color: #f59e0b; font-size: 20px; }

    .ai-header-controls { display: flex; align-items: center; gap: 8px; }
    .provider-select {
      background: #334155;
      color: #f1f5f9;
      border: 1px solid #475569;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .btn-close { background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer; }

    .ai-drawer-body {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .quick-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .quick-chips button {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      color: #334155;
      padding: 6px 10px;
      border-radius: 20px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.2s;
    }
    .quick-chips button:hover { background: #eff6ff; border-color: #3b82f6; color: #1d4ed8; }

    .chat-messages { display: flex; flex-direction: column; gap: 12px; }
    .chat-bubble {
      max-width: 90%;
      padding: 12px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
    }
    .chat-bubble.user {
      align-self: flex-end;
      background: #2563eb;
      color: #ffffff;
      border-bottom-right-radius: 2px;
    }
    .chat-bubble.ai {
      align-self: flex-start;
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #e2e8f0;
      border-bottom-left-radius: 2px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
    }
    .chat-bubble.loading { color: #64748b; font-style: italic; }

    .bubble-meta { display: flex; justify-content: space-between; font-size: 10px; opacity: 0.8; margin-bottom: 4px; }
    .provider-badge { background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 600; }

    .citations-container { margin-top: 10px; padding-top: 8px; border-top: 1px solid #f1f5f9; }
    .citations-title { font-size: 11px; font-weight: 700; color: #475569; }
    .citation-card {
      background: #f1f5f9;
      padding: 6px 10px;
      border-radius: 6px;
      margin-top: 4px;
      font-size: 11px;
    }

    .action-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .action-buttons button {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 6px;
      cursor: pointer;
    }

    .ai-drawer-footer {
      padding: 12px 16px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 8px;
      border-bottom-left-radius: 16px;
      border-bottom-right-radius: 16px;
    }
    .ai-drawer-footer input {
      flex: 1;
      border: 1px solid #cbd5e1;
      padding: 10px 14px;
      border-radius: 20px;
      font-size: 13px;
      outline: none;
    }
    .ai-drawer-footer input:focus { border-color: #2563eb; }
    .ai-drawer-footer button {
      background: #2563eb;
      color: #fff;
      border: none;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      cursor: pointer;
    }
  `]
})
export class AiAssistantComponent implements OnInit {
  isOpen = false;
  isLoading = false;
  userInput = '';
  selectedProvider = 'Auto';
  messages: ChatMessage[] = [];

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.messages.push({
      sender: 'ai',
      text: 'Hello! I am your **TAHDCO AI Copilot**. Ask me anything about TIPS civil works, THMS housing phases, welfare scheme applications, or official G.O. guidelines.',
      provider: 'TAHDCO-Native-AI',
      timestamp: new Date()
    });
  }

  toggleWidget(): void {
    this.isOpen = !this.isOpen;
  }

  quickPrompt(text: string): void {
    this.userInput = text;
    this.sendMessage();
  }

  sendMessage(): void {
    if (!this.userInput.trim() || this.isLoading) return;

    const query = this.userInput.trim();
    this.messages.push({
      sender: 'user',
      text: query,
      timestamp: new Date()
    });

    this.userInput = '';
    this.isLoading = true;

    this.dataService.processAiChat({
      userQuery: query,
      financialYear: 'FY 2025-26',
      preferredProvider: this.selectedProvider
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.messages.push({
          sender: 'ai',
          text: res.answer,
          provider: res.providerUsed || 'TAHDCO AI',
          model: res.modelUsed,
          citations: res.citations,
          actions: res.actionSuggestions,
          timestamp: new Date()
        });
      },
      error: () => {
        this.isLoading = false;
        this.messages.push({
          sender: 'ai',
          text: 'An error occurred while connecting to the TAHDCO AI engine.',
          timestamp: new Date()
        });
      }
    });
  }

  executeSuggestedAction(actionName: string): void {
    this.messages.push({
      sender: 'user',
      text: `[Action Triggered] ${actionName}`,
      timestamp: new Date()
    });
    this.messages.push({
      sender: 'ai',
      text: `Executed action **${actionName}**. Request processed by TAHDCO Workflow Automation Agent.`,
      provider: 'Automation-Agent',
      timestamp: new Date()
    });
  }

  formatMarkdown(text: string): string {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/### (.*?)\n/g, '<h4 style="margin:6px 0; color:#1e293b;">$1</h4>')
      .replace(/\n/g, '<br/>');
  }
}
