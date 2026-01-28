export type NCRCity = {
  name: string;
  barangays: string[];
  zipCodes: Record<string, string>; // barangay -> zip (optional entries)
  defaultZip: string; // fallback when barangay zip is missing
};

// Curated sample set; extend as needed
export const ncrCities: NCRCity[] = [
  // Manila
  {
    name: 'Manila',
    barangays: ['Ermita', 'Intramuros', 'Malate', 'Paco', 'Pandacan', 'Binondo', 'Quiapo', 'Tondo'],
    zipCodes: {
      Ermita: '1000',
      Intramuros: '1002',
      Malate: '1004',
      Paco: '1007',
      Pandacan: '1011',
      Binondo: '1006',
      Quiapo: '1001',
      Tondo: '1012',
    },
    defaultZip: '1000',
  },
  // Quezon City
  {
    name: 'Quezon City',
    barangays: ['Bagumbayan', 'Batasan Hills', 'Commonwealth', 'Diliman', 'Matandang Balara', 'Project 6', 'Novaliches', 'Cubao'],
    zipCodes: {
      Bagumbayan: '1110',
      'Batasan Hills': '1126',
      Commonwealth: '1121',
      Diliman: '1101',
      'Matandang Balara': '1119',
      'Project 6': '1100',
      Novaliches: '1123',
      Cubao: '1109',
    },
    defaultZip: '1100',
  },
  // Caloocan
  {
    name: 'Caloocan',
    barangays: ['Bagong Barrio', 'Grace Park West', 'Maypajo', 'Camarin', 'Deparo', 'Kaybiga'],
    zipCodes: {
      'Bagong Barrio': '1401',
      'Grace Park West': '1403',
      Maypajo: '1405',
      Camarin: '1408',
      Deparo: '1420',
      Kaybiga: '1425',
    },
    defaultZip: '1400',
  },
  // Las Piñas
  {
    name: 'Las Piñas',
    barangays: ['Almanza Uno', 'Almanza Dos', 'Pamplona Tres', 'Talon Dos', 'Talon Kuatro', 'BF International'],
    zipCodes: {
      'Almanza Uno': '1755',
      'Almanza Dos': '1750',
      'Pamplona Tres': '1750',
      'Talon Dos': '1747',
      'Talon Kuatro': '1747',
      'BF International': '1740',
    },
    defaultZip: '1740',
  },
  // Makati
  {
    name: 'Makati',
    barangays: ['Bel-Air', 'San Lorenzo', 'Poblacion', 'Dasmariñas', 'Magallanes', 'San Antonio'],
    zipCodes: {
      'Bel-Air': '1209',
      'San Lorenzo': '1223',
      Poblacion: '1210',
      Dasmariñas: '1221',
      Magallanes: '1232',
      'San Antonio': '1203',
    },
    defaultZip: '1200',
  },
  // Malabon
  {
    name: 'Malabon',
    barangays: ['Tugatog', 'Tañong', 'Longos', 'Potrero', 'Tinajeros'],
    zipCodes: {
      Tugatog: '1471',
      Tañong: '1470',
      Longos: '1472',
      Potrero: '1475',
      Tinajeros: '1472',
    },
    defaultZip: '1470',
  },
  // Mandaluyong
  {
    name: 'Mandaluyong',
    barangays: ['Plainview', 'Addition Hills', 'Barangka Ilaya', 'Mauway', 'Wack-Wack'],
    zipCodes: {
      Plainview: '1550',
      'Addition Hills': '1552',
      'Barangka Ilaya': '1553',
      Mauway: '1550',
      'Wack-Wack': '1555',
    },
    defaultZip: '1550',
  },
  // Marikina
  {
    name: 'Marikina',
    barangays: ['Barangka', 'Concepcion Uno', 'Concepcion Dos', 'Nangka', 'Industrial Valley'],
    zipCodes: {
      Barangka: '1803',
      'Concepcion Uno': '1807',
      'Concepcion Dos': '1806',
      Nangka: '1808',
      'Industrial Valley': '1803',
    },
    defaultZip: '1800',
  },
  // Muntinlupa
  {
    name: 'Muntinlupa',
    barangays: ['Alabang', 'Ayala Alabang', 'Cupang', 'Putatan', 'Tunasan'],
    zipCodes: {
      Alabang: '1781',
      'Ayala Alabang': '1799',
      Cupang: '1771',
      Putatan: '1772',
      Tunasan: '1773',
    },
    defaultZip: '1770',
  },
  // Navotas
  {
    name: 'Navotas',
    barangays: ['San Jose', 'North Bay Boulevard', 'Tangos', 'Tanza'],
    zipCodes: {
      'San Jose': '1485',
      'North Bay Boulevard': '1485',
      Tangos: '1489',
      Tanza: '1490',
    },
    defaultZip: '1485',
  },
  // Parañaque
  {
    name: 'Parañaque',
    barangays: ['BF Homes', 'San Antonio', 'Sun Valley', 'Don Bosco', 'Sucat'],
    zipCodes: {
      'BF Homes': '1720',
      'San Antonio': '1707',
      'Sun Valley': '1700',
      'Don Bosco': '1711',
      Sucat: '1701',
    },
    defaultZip: '1700',
  },
  // Pasay
  {
    name: 'Pasay',
    barangays: ['Baclaran', 'San Isidro', 'San Jose', 'Malibay', 'Vitalez'],
    zipCodes: {
      Baclaran: '1302',
      'San Isidro': '1306',
      'San Jose': '1305',
      Malibay: '1300',
      Vitalez: '1303',
    },
    defaultZip: '1300',
  },
  // Pasig
  {
    name: 'Pasig',
    barangays: ['Bagong Ilog', 'Ugong', 'Ortigas Center', 'Pinagbuhatan', 'Santolan'],
    zipCodes: {
      'Bagong Ilog': '1600',
      Ugong: '1604',
      'Ortigas Center': '1605',
      Pinagbuhatan: '1602',
      Santolan: '1610',
    },
    defaultZip: '1600',
  },
  // San Juan
  {
    name: 'San Juan',
    barangays: ['Addition Hills', 'Balong-Bato', 'Greenhills', 'Little Baguio', 'Pasadeña'],
    zipCodes: {
      'Addition Hills': '1500',
      'Balong-Bato': '1509',
      Greenhills: '1502',
      'Little Baguio': '1503',
      Pasadeña: '1504',
    },
    defaultZip: '1500',
  },
  // Taguig
  {
    name: 'Taguig',
    barangays: ['Fort Bonifacio', 'Lower Bicutan', 'Upper Bicutan', 'Bagumbayan', 'Western Bicutan'],
    zipCodes: {
      'Fort Bonifacio': '1634',
      'Lower Bicutan': '1632',
      'Upper Bicutan': '1633',
      Bagumbayan: '1631',
      'Western Bicutan': '1630',
    },
    defaultZip: '1630',
  },
  // Valenzuela
  {
    name: 'Valenzuela',
    barangays: ['Malinta', 'Karuhatan', 'Marulas', 'Gen. T. de Leon', 'Mapulang Lupa'],
    zipCodes: {
      Malinta: '1440',
      Karuhatan: '1441',
      Marulas: '1440',
      'Gen. T. de Leon': '1442',
      'Mapulang Lupa': '1448',
    },
    defaultZip: '1440',
  },
  // Pateros
  {
    name: 'Pateros',
    barangays: ['Aguho', 'Santa Ana', 'Sto. Rosario-Silangan', 'Magtanggol'],
    zipCodes: {
      Aguho: '1620',
      'Santa Ana': '1621',
      'Sto. Rosario-Silangan': '1622',
      Magtanggol: '1623',
    },
    defaultZip: '1620',
  },
];

export const cityNames = ncrCities.map((c) => c.name);

export function getBarangaysForCity(city: string): string[] {
  const c = ncrCities.find((x) => x.name === city);
  return c ? c.barangays : [];
}

export function getZipFor(city: string, barangay: string): string {
  const c = ncrCities.find((x) => x.name === city);
  if (!c) return '';
  return c.zipCodes[barangay] || c.defaultZip || '';
}
