import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard }           from './core/guards/auth.guard';
import { ShellComponent }      from './shared/components/shell.component';
import { LoginComponent }      from './modules/login/login.component';
import { DashboardComponent }  from './modules/dashboard/dashboard.component';
import { OverviewComponent }   from './modules/overview/overview.component';
import { DrillComponent }      from './modules/drill/drill.component';
import { HousingComponent }    from './modules/housing/housing.component';
import { TenderComponent }     from './modules/tender/tender.component';
import { EnrollmentComponent } from './modules/enrollment/enrollment.component';
import { SchemeReportComponent }from './modules/scheme-report/scheme-report.component';
import { TodComponent }        from './modules/tod/tod.component';
import { Patrol360Component }  from './modules/patrol360/patrol360.component';
import { UserMasterComponent } from './modules/user-master/user-master.component';
import { ConfigurationComponent } from './modules/configuration/configuration.component';
import { SchedulerManagementComponent } from './modules/scheduler-management/scheduler-management.component';
import { DashboardMdComponent } from './modules/dashboard-md/dashboard-md.component';
import { TncwwbComponent }     from './modules/tncwwb/tncwwb.component';
import { AiAnalyticsComponent } from './modules/ai-analytics/ai-analytics.component';
import { IngestionDashboardComponent } from './modules/ingestion-dashboard/ingestion-dashboard.component';
import { AuditLogComponent } from './modules/audit-log/audit-log.component';
import { MultiDashboardComponent } from './modules/multi-dashboard/multi-dashboard.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '', component: ShellComponent, canActivate: [AuthGuard],
    children: [
      { path: '',               redirectTo: 'dashboard-md', pathMatch: 'full' },
      { path: 'overview',       component: OverviewComponent },
      { path: 'drill/:moduleId', component: DrillComponent },
      { path: 'dashboard',      component: DashboardComponent },
      { path: 'housing',        component: HousingComponent,      data: { app: 'THMS' } },
      { path: 'tender',         component: TenderComponent,       data: { app: 'TIPS' } },
      { path: 'enrollment',     component: EnrollmentComponent,   data: { app: 'TAMS' } },
      { path: 'scheme-report',  component: SchemeReportComponent, data: { apps: ['Scheme','TELP','OnePortal'] } },
      { path: 'tncwwb',         component: TncwwbComponent,       data: { app: 'TNCWWB' } },
      { path: 'tod',            component: TodComponent,          data: { app: 'TOD'  } },
      { path: 'patrol360',      component: Patrol360Component,    data: { app: 'Patrol360' } },
      { path: 'user-master',            component: UserMasterComponent,          data: { roles: ['admin'] } },
      { path: 'configuration',           component: ConfigurationComponent,       data: { roles: ['admin', 'md'] } },
      { path: 'scheduler-management',    component: SchedulerManagementComponent, data: { roles: ['admin'] } },
      { path: 'audit-log',              component: AuditLogComponent,            data: { roles: ['admin'] } },
      { path: 'ai-analytics',           component: AiAnalyticsComponent,         data: { roles: ['admin'] } },
      { path: 'ingestion',              component: IngestionDashboardComponent,  data: { roles: ['admin'] } },
      { path: 'dashboard-md',            component: DashboardMdComponent },
      { path: 'multi-dashboard',         component: MultiDashboardComponent, data: { roles: ['admin'], apps: ['TELP','Scheme','Patrol360','THMS','TAMS','OnePortal'] } },
    ]
  },
  { path: '**', redirectTo: 'login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
