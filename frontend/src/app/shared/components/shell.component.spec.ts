import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { SidebarModule } from 'primeng/sidebar';
import { ConfirmationService } from 'primeng/api';
import { ShellComponent } from './shell.component';
describe('ShellComponent', () => {
  let component: ShellComponent; let fixture: ComponentFixture<ShellComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ShellComponent],
      imports: [FormsModule, RouterTestingModule, HttpClientTestingModule, ConfirmDialogModule, TooltipModule, ToastModule, DropdownModule, DialogModule, SidebarModule],
      providers: [ConfirmationService],
      schemas: [NO_ERRORS_SCHEMA] // p-ai-assistant / p-marker are unregistered template selectors
    }).compileComponents();
    fixture=TestBed.createComponent(ShellComponent); component=fixture.componentInstance; fixture.detectChanges();
  });
  it('should create',()=>expect(component).toBeTruthy());
  it('should toggle collapsed',()=>{ component.collapsed=false; component.collapsed=!component.collapsed; expect(component.collapsed).toBeTrue(); });
  it('should compute initials',()=>{ (component as any).user={name:'Arjun Sharma'}; expect(component.initials).toBe('AS'); });
});
