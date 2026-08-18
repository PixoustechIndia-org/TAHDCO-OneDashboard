import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// PrimeNG
import { ButtonModule }          from 'primeng/button';
import { InputTextModule }       from 'primeng/inputtext';
import { DropdownModule }        from 'primeng/dropdown';
import { TableModule }           from 'primeng/table';
import { CardModule }            from 'primeng/card';
import { DialogModule }          from 'primeng/dialog';
import { ToastModule }           from 'primeng/toast';
import { ConfirmDialogModule }   from 'primeng/confirmdialog';
import { TooltipModule }         from 'primeng/tooltip';
import { InputSwitchModule }     from 'primeng/inputswitch';
import { ChartModule }           from 'primeng/chart';
import { ChipModule }            from 'primeng/chip';
import { TagModule }             from 'primeng/tag';
import { BadgeModule }           from 'primeng/badge';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CalendarModule }        from 'primeng/calendar';
import { MultiSelectModule }     from 'primeng/multiselect';
import { CheckboxModule }        from 'primeng/checkbox';
import { PanelModule }           from 'primeng/panel';
import { DividerModule }         from 'primeng/divider';
import { TabViewModule }         from 'primeng/tabview';
import { MessageModule }         from 'primeng/message';
import { MessagesModule }        from 'primeng/messages';
import { PasswordModule }        from 'primeng/password';
import { AvatarModule }          from 'primeng/avatar';
import { SkeletonModule }        from 'primeng/skeleton';
import { SidebarModule }         from 'primeng/sidebar';
import { MessageService, ConfirmationService } from 'primeng/api';

// App
import { AppRoutingModule }        from './app-routing.module';
import { AppComponent }            from './app.component';
import { AuthInterceptor }         from './core/interceptors/auth.interceptor';
import { ShellComponent }          from './shared/components/shell.component';
import { LoginComponent }          from './modules/login/login.component';
import { DashboardComponent }      from './modules/dashboard/dashboard.component';
import { OverviewComponent }       from './modules/overview/overview.component';
import { DrillComponent }          from './modules/drill/drill.component';
import { HousingComponent }        from './modules/housing/housing.component';
import { TenderComponent }         from './modules/tender/tender.component';
import { EnrollmentComponent }     from './modules/enrollment/enrollment.component';
import { SchemeReportComponent }   from './modules/scheme-report/scheme-report.component';
import { TodComponent }            from './modules/tod/tod.component';
import { Patrol360Component }      from './modules/patrol360/patrol360.component';
import { UserMasterComponent }     from './modules/user-master/user-master.component';
import { ConfigurationComponent }  from './modules/configuration/configuration.component';
import { SchedulerManagementComponent } from './modules/scheduler-management/scheduler-management.component';
import { DashboardMdComponent }    from './modules/dashboard-md/dashboard-md.component';
import { TncwwbComponent }         from './modules/tncwwb/tncwwb.component';
import { AiAssistantComponent }    from './shared/components/ai-assistant.component';
import { AiAnalyticsComponent }    from './modules/ai-analytics/ai-analytics.component';
import { IngestionDashboardComponent } from './modules/ingestion-dashboard/ingestion-dashboard.component';
import { AuditLogComponent }          from './modules/audit-log/audit-log.component';
import { MultiDashboardComponent }    from './modules/multi-dashboard/multi-dashboard.component';

const PRIMENG_MODULES = [
  ButtonModule, InputTextModule, DropdownModule, TableModule, CardModule,
  DialogModule, ToastModule, ConfirmDialogModule, TooltipModule, InputSwitchModule,
  ChartModule, ChipModule, TagModule, BadgeModule, ProgressSpinnerModule,
  CalendarModule, MultiSelectModule, CheckboxModule, PanelModule, DividerModule, TabViewModule,
  MessageModule, MessagesModule, PasswordModule, AvatarModule, SkeletonModule, SidebarModule
];

@NgModule({
  declarations: [
    AppComponent, ShellComponent, AiAssistantComponent, AiAnalyticsComponent, IngestionDashboardComponent,
    AuditLogComponent, LoginComponent, DashboardComponent, OverviewComponent, DrillComponent,
    HousingComponent, TenderComponent, EnrollmentComponent,
    SchemeReportComponent, TodComponent, Patrol360Component, UserMasterComponent,
    ConfigurationComponent, SchedulerManagementComponent,
    DashboardMdComponent, TncwwbComponent, MultiDashboardComponent,
  ],
  imports: [
    BrowserModule, BrowserAnimationsModule, HttpClientModule,
    FormsModule, ReactiveFormsModule, CommonModule,
    AppRoutingModule, ...PRIMENG_MODULES,
  ],
  providers: [
    MessageService, ConfirmationService,
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
