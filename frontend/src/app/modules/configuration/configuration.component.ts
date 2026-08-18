import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MessageService, ConfirmationService } from 'primeng/api';
import { catchError, of } from 'rxjs';
import * as XLSX from 'xlsx';
import { environment } from '../../../environments/environment';

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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRecords();
  }

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

  onFileChange(event: any): void {
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
          const parsedRecords: LocalBodyMapping[] = rows.map((r, idx) => {
            const getVal = (patterns: string[]) => {
              for (const p of patterns) {
                const foundKey = Object.keys(r).find(k => 
                  k.toLowerCase().replace(/[\s_-]/g, '') === p.toLowerCase().replace(/[\s_-]/g, '')
                );
                if (foundKey && r[foundKey] !== undefined && r[foundKey] !== null) {
                  return String(r[foundKey]).trim();
                }
              }
              return '-';
            };

            return {
              id: Date.now() + idx,
              sno: idx + 1,
              state: getVal(['state', 'state_name']) || 'Tamil Nadu',
              division: getVal(['division', 'div']),
              district: getVal(['district', 'dist']),
              localBody: getVal(['local_body', 'localbody', 'type']),
              localBodyName: getVal(['local_body_name', 'name of the localbody', 'name', 'localbodyname']),
              block: getVal(['block', 'taluk']),
              villagePanchayat: getVal(['village_panchayat', 'village pancayet', 'panchayat']),
              corporation: getVal(['corporation', 'corrpration']),
              townPanchayat: getVal(['town_panchayat', 'townpanyptet']),
              municipality: getVal(['municipality', 'muncipality']),
              gcc: getVal(['gcc']),
              cmwssb: getVal(['cmwssb', 'cmws'])
            };
          });

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
