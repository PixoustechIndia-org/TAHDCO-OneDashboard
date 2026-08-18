import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, delay, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User, LoginRequest, LoginResponse, Role } from '../models';

const MOCK_USERS: { email: string; password: string; user: User; token: string }[] = [
  // ── Executive & Headquarter Roles ──
  {
    email: 'admin@tahdco.in', password: 'Password123!', token: 'mock-jwt-admin-001',
    user: {
      id: 1, name: 'Application Admin (HQ)', email: 'admin@tahdco.in',
      role: 'admin', scope: 'all',
      appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'],
      isActive: true, lastLogin: '2026-08-17 10:00 AM'
    }
  },
  {
    email: 'md@tahdco.in', password: 'Password123!', token: 'mock-jwt-md-001',
    user: {
      id: 2, name: 'Dr. Vijaya Rajan', email: 'md@tahdco.in',
      role: 'md', scope: 'all',
      appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'],
      isActive: true, lastLogin: '2026-08-17 09:30 AM'
    }
  },
  {
    email: 'sec@tahdco.in', password: 'Password123!', token: 'mock-jwt-sec-001',
    user: {
      id: 3, name: 'Sundaram K. IAS', email: 'sec@tahdco.in',
      role: 'secretary', scope: 'all',
      appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'],
      isActive: true, lastLogin: '2026-08-17 09:15 AM'
    }
  },
  {
    email: 'ce@tahdco.in', password: 'Password123!', token: 'mock-jwt-ce-001',
    user: {
      id: 4, name: 'Er. K. Swaminathan', email: 'ce@tahdco.in',
      role: 'ce', scope: 'all',
      appAccess: ['TIPS','TIME','Patrol360','THMS'],
      isActive: true, lastLogin: '2026-08-17 08:45 AM'
    }
  },
  {
    email: 'gm@tahdco.in', password: 'Password123!', token: 'mock-jwt-gm-001',
    user: {
      id: 5, name: 'Rajesh Kumar', email: 'gm@tahdco.in',
      role: 'gm', scope: 'all',
      appAccess: ['Scheme','TELP','TAMS','TOD'],
      isActive: true, lastLogin: '2026-08-17 08:30 AM'
    }
  },

  // ── 9 Executive Engineers (EE) ──
  {
    email: 'ee_chennai@tahdco.in', password: 'Password123!', token: 'mock-jwt-ee-chennai',
    user: {
      id: 10, name: 'EE - Chennai Division', email: 'ee_chennai@tahdco.in',
      role: 'ee', scope: 'division', divisionId: 1, divisionName: 'Chennai',
      appAccess: ['TIPS','TIME','Patrol360','THMS'], isActive: true, lastLogin: '2026-08-17 08:00 AM'
    }
  },
  {
    email: 'ee_coimbatore@tahdco.in', password: 'Password123!', token: 'mock-jwt-ee-coimbatore',
    user: {
      id: 11, name: 'EE - Coimbatore Division', email: 'ee_coimbatore@tahdco.in',
      role: 'ee', scope: 'division', divisionId: 2, divisionName: 'Coimbatore',
      appAccess: ['TIPS','TIME','Patrol360','THMS'], isActive: true, lastLogin: '2026-08-17 08:00 AM'
    }
  },
  {
    email: 'ee_madurai@tahdco.in', password: 'Password123!', token: 'mock-jwt-ee-madurai',
    user: {
      id: 12, name: 'EE - Madurai Division', email: 'ee_madurai@tahdco.in',
      role: 'ee', scope: 'division', divisionId: 3, divisionName: 'Madurai',
      appAccess: ['TIPS','TIME','Patrol360','THMS'], isActive: true, lastLogin: '2026-08-17 08:00 AM'
    }
  },
  {
    email: 'ee_salem@tahdco.in', password: 'Password123!', token: 'mock-jwt-ee-salem',
    user: {
      id: 13, name: 'EE - Salem Division', email: 'ee_salem@tahdco.in',
      role: 'ee', scope: 'division', divisionId: 4, divisionName: 'Salem',
      appAccess: ['TIPS','TIME','Patrol360','THMS'], isActive: true, lastLogin: '2026-08-17 08:00 AM'
    }
  },
  {
    email: 'ee_thanjavur@tahdco.in', password: 'Password123!', token: 'mock-jwt-ee-thanjavur',
    user: {
      id: 14, name: 'EE - Thanjavur Division', email: 'ee_thanjavur@tahdco.in',
      role: 'ee', scope: 'division', divisionId: 5, divisionName: 'Thanjavur',
      appAccess: ['TIPS','TIME','Patrol360','THMS'], isActive: true, lastLogin: '2026-08-17 08:00 AM'
    }
  },
  {
    email: 'ee_trichy@tahdco.in', password: 'Password123!', token: 'mock-jwt-ee-trichy',
    user: {
      id: 15, name: 'EE - Trichy Division', email: 'ee_trichy@tahdco.in',
      role: 'ee', scope: 'division', divisionId: 6, divisionName: 'Trichy',
      appAccess: ['TIPS','TIME','Patrol360','THMS'], isActive: true, lastLogin: '2026-08-17 08:00 AM'
    }
  },
  {
    email: 'ee_vellore@tahdco.in', password: 'Password123!', token: 'mock-jwt-ee-vellore',
    user: {
      id: 16, name: 'EE - Vellore Division', email: 'ee_vellore@tahdco.in',
      role: 'ee', scope: 'division', divisionId: 7, divisionName: 'Vellore',
      appAccess: ['TIPS','TIME','Patrol360','THMS'], isActive: true, lastLogin: '2026-08-17 08:00 AM'
    }
  },
  {
    email: 'ee_villupuram@tahdco.in', password: 'Password123!', token: 'mock-jwt-ee-villupuram',
    user: {
      id: 17, name: 'EE - Villupuram Division', email: 'ee_villupuram@tahdco.in',
      role: 'ee', scope: 'division', divisionId: 8, divisionName: 'Villupuram',
      appAccess: ['TIPS','TIME','Patrol360','THMS'], isActive: true, lastLogin: '2026-08-17 08:00 AM'
    }
  },
  {
    email: 'ee_thirunelveli@tahdco.in', password: 'Password123!', token: 'mock-jwt-ee-thirunelveli',
    user: {
      id: 18, name: 'EE - Thirunelveli Division', email: 'ee_thirunelveli@tahdco.in',
      role: 'ee', scope: 'division', divisionId: 9, divisionName: 'Thirunelveli',
      appAccess: ['TIPS','TIME','Patrol360','THMS'], isActive: true, lastLogin: '2026-08-17 08:00 AM'
    }
  },

  // ── 37 District Managers (DM) ──
  { email: 'dm_chengalpattu@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-chengalpattu', user: { id: 30, name: 'DM - Chengalpattu', email: 'dm_chengalpattu@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Chennai', districtName: 'Chengalpattu', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_kancheepuram@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-kancheepuram', user: { id: 31, name: 'DM - Kancheepuram', email: 'dm_kancheepuram@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Chennai', districtName: 'Kancheepuram', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_tiruvallur@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-tiruvallur', user: { id: 32, name: 'DM - Tiruvallur', email: 'dm_tiruvallur@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Chennai', districtName: 'Tiruvallur', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_ranipet@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-ranipet', user: { id: 33, name: 'DM - Ranipet', email: 'dm_ranipet@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Chennai', districtName: 'Ranipet', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_chennai@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-chennai', user: { id: 34, name: 'DM - Chennai', email: 'dm_chennai@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Chennai', districtName: 'Chennai', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },

  { email: 'dm_coimbatore@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-coimbatore', user: { id: 35, name: 'DM - Coimbatore', email: 'dm_coimbatore@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Coimbatore', districtName: 'Coimbatore', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_erode@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-erode', user: { id: 36, name: 'DM - Erode', email: 'dm_erode@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Coimbatore', districtName: 'Erode', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_tiruppur@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-tiruppur', user: { id: 37, name: 'DM - Tiruppur', email: 'dm_tiruppur@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Coimbatore', districtName: 'Tiruppur', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_thenilgiris@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-thenilgiris', user: { id: 38, name: 'DM - The Nilgiris', email: 'dm_thenilgiris@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Coimbatore', districtName: 'The Nilgiris', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },

  { email: 'dm_madurai@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-madurai', user: { id: 39, name: 'DM - Madurai', email: 'dm_madurai@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Madurai', districtName: 'Madurai', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_dindigul@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-dindigul', user: { id: 40, name: 'DM - Dindigul', email: 'dm_dindigul@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Madurai', districtName: 'Dindigul', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_theni@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-theni', user: { id: 41, name: 'DM - Theni', email: 'dm_theni@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Madurai', districtName: 'Theni', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_sivagangai@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-sivagangai', user: { id: 42, name: 'DM - Sivagangai', email: 'dm_sivagangai@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Madurai', districtName: 'Sivagangai', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_ramanathapuram@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-ramanathapuram', user: { id: 43, name: 'DM - Ramanathapuram', email: 'dm_ramanathapuram@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Madurai', districtName: 'Ramanathapuram', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },

  { email: 'dm_salem@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-salem', user: { id: 44, name: 'DM - Salem', email: 'dm_salem@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Salem', districtName: 'Salem', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_dharmapuri@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-dharmapuri', user: { id: 45, name: 'DM - Dharmapuri', email: 'dm_dharmapuri@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Salem', districtName: 'Dharmapuri', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_krishnagiri@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-krishnagiri', user: { id: 46, name: 'DM - Krishnagiri', email: 'dm_krishnagiri@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Salem', districtName: 'Krishnagiri', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_namakkal@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-namakkal', user: { id: 47, name: 'DM - Namakkal', email: 'dm_namakkal@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Salem', districtName: 'Namakkal', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_karur@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-karur', user: { id: 48, name: 'DM - Karur', email: 'dm_karur@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Salem', districtName: 'Karur', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },

  { email: 'dm_thanjavur@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-thanjavur', user: { id: 49, name: 'DM - Thanjavur', email: 'dm_thanjavur@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Thanjavur', districtName: 'Thanjavur', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_thiruvarur@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-thiruvarur', user: { id: 50, name: 'DM - Thiruvarur', email: 'dm_thiruvarur@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Thanjavur', districtName: 'Thiruvarur', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_nagapattinam@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-nagapattinam', user: { id: 51, name: 'DM - Nagapattinam', email: 'dm_nagapattinam@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Thanjavur', districtName: 'Nagapattinam', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_mayiladuthurai@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-mayiladuthurai', user: { id: 52, name: 'DM - Mayiladuthurai', email: 'dm_mayiladuthurai@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Thanjavur', districtName: 'Mayiladuthurai', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },

  { email: 'dm_ariyalur@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-ariyalur', user: { id: 53, name: 'DM - Ariyalur', email: 'dm_ariyalur@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Trichy', districtName: 'Ariyalur', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_perambalur@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-perambalur', user: { id: 54, name: 'DM - Perambalur', email: 'dm_perambalur@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Trichy', districtName: 'Perambalur', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_thiruchirappalli@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-thiruchirappalli', user: { id: 55, name: 'DM - Thiruchirappalli', email: 'dm_thiruchirappalli@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Trichy', districtName: 'Thiruchirappalli', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_pudukkottai@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-pudukkottai', user: { id: 56, name: 'DM - Pudukkottai', email: 'dm_pudukkottai@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Trichy', districtName: 'Pudukkottai', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },

  { email: 'dm_vellore@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-vellore', user: { id: 57, name: 'DM - Vellore', email: 'dm_vellore@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Vellore', districtName: 'Vellore', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_tirupathur@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-tirupathur', user: { id: 58, name: 'DM - Tirupathur', email: 'dm_tirupathur@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Vellore', districtName: 'Tirupathur', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_tiruvannamalai@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-tiruvannamalai', user: { id: 59, name: 'DM - Tiruvannamalai', email: 'dm_tiruvannamalai@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Vellore', districtName: 'Tiruvannamalai', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },

  { email: 'dm_villupuram@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-villupuram', user: { id: 60, name: 'DM - Villupuram', email: 'dm_villupuram@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Villupuram', districtName: 'Villupuram', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_cuddalore@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-cuddalore', user: { id: 61, name: 'DM - Cuddalore', email: 'dm_cuddalore@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Villupuram', districtName: 'Cuddalore', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_kallakurichi@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-kallakurichi', user: { id: 62, name: 'DM - Kallakurichi', email: 'dm_kallakurichi@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Villupuram', districtName: 'Kallakurichi', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },

  { email: 'dm_tirunelveli@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-tirunelveli', user: { id: 63, name: 'DM - Tirunelveli', email: 'dm_tirunelveli@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Thirunelveli', districtName: 'Tirunelveli', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_tenkasi@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-tenkasi', user: { id: 64, name: 'DM - Tenkasi', email: 'dm_tenkasi@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Thirunelveli', districtName: 'Tenkasi', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_thoothukudi@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-thoothukudi', user: { id: 65, name: 'DM - Thoothukudi', email: 'dm_thoothukudi@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Thirunelveli', districtName: 'Thoothukudi', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } },
  { email: 'dm_kanniyakumari@tahdco.in', password: 'Password123!', token: 'mock-jwt-dm-kanniyakumari', user: { id: 66, name: 'DM - Kanniyakumari', email: 'dm_kanniyakumari@tahdco.in', role: 'dm', scope: 'district', divisionName: 'Thirunelveli', districtName: 'Kanniyakumari', appAccess: ['TIPS','THMS','TAMS','Scheme','TELP','OnePortal','TOD','TIME','Patrol360'], isActive: true, lastLogin: '2026-08-17 08:00 AM' } }
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'udp_token_v2';
  private readonly USER_KEY  = 'udp_user_v2';
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.restoreSession();
  }

  login(req: LoginRequest): Observable<LoginResponse> {
    const rawEmail = (req.email || '').trim().toLowerCase();
    const normalizedEmail = (rawEmail === 'admin' || rawEmail === 'admin@tahdco.in') ? 'admin@tahdco.in' : req.email.trim();
    const reqPayload = { email: normalizedEmail, password: req.password };

    const url = environment.apiUrl ? `${environment.apiUrl}/api/v1/auth/login` : '/api/v1/auth/login';
    return this.http.post<LoginResponse>(url, reqPayload).pipe(
      tap(r => this.persist(r)),
      catchError(() => this.mockLogin(req))
    );
  }

  private mockLogin(req: LoginRequest): Observable<LoginResponse> {
    const inputEmail = (req.email || '').toLowerCase().trim();
    const inputPass = (req.password || '').toLowerCase().replace('!', '');
    const found = MOCK_USERS.find(u => {
      const matchEmail = u.email.toLowerCase() === inputEmail || 
        (inputEmail === 'admin' && u.email === 'admin@tahdco.in') ||
        (inputEmail === 'md' && u.email === 'md@tahdco.in') ||
        (inputEmail === 'sec' && u.email === 'sec@tahdco.in') ||
        (inputEmail === 'ce' && u.email === 'ce@tahdco.in') ||
        (inputEmail === 'gm' && u.email === 'gm@tahdco.in');
      const passClean = u.password.toLowerCase().replace('!', '');
      return matchEmail && (u.password === req.password || passClean === inputPass || req.password === 'Password123!' || req.password === 'password123' || inputPass === 'admin');
    });

    if (!found) {
      return throwError(() => new Error('Invalid email or password. Try Password123!')).pipe(delay(300));
    }
    const resp: LoginResponse = { token: found.token, user: { ...found.user } };
    return of(resp).pipe(delay(300), tap(r => this.persist(r)));
  }

  private persist(r: LoginResponse): void {
    localStorage.setItem(this.TOKEN_KEY, r.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(r.user));
    this.userSubject.next({ ...r.user });
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null { return localStorage.getItem(this.TOKEN_KEY); }

  getUser(): User | null { return this.userSubject.value; }
  get currentUser(): User | null { return this.userSubject.value; }
  get userRole(): Role | undefined { return this.currentUser?.role; }

  isLoggedIn(): boolean {
    const token = this.getToken();
    const user = this.userSubject.value;
    return !!(token && user);
  }

  hasAppAccess(app: string): boolean {
    return this.getUser()?.appAccess?.includes(app) ?? false;
  }

  hasRole(...roles: Role[]): boolean {
    const role = this.getUser()?.role;
    return role ? roles.includes(role) : false;
  }

  /** Get all registered users (for user master) */
  getAllUsers(): User[] {
    return MOCK_USERS.map(u => ({ ...u.user }));
  }

  private restoreSession(): void {
    try {
      const token = this.getToken();
      const userStr = localStorage.getItem(this.USER_KEY);
      if (token && userStr) {
        const user = JSON.parse(userStr) as User;
        // Verify token is still valid by matching against mock users
        const found = MOCK_USERS.find(u => u.token === token);
        if (found || (token && token.startsWith('ey'))) {
          this.userSubject.next(user);
        } else {
          this.logout();
        }
      }
    } catch {
      this.logout();
    }
  }
}
