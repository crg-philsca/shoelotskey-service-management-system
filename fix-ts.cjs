const fs = require('fs');

const files = [
    'src/app/components/EditOrderModal.tsx',
    'src/app/components/ProcessClaimModal.tsx',
    'src/app/pages/CalendarView.tsx',
    'src/app/pages/ClaimMonitoring.tsx',
    'src/app/pages/Dashboard.tsx',
    'src/app/pages/JobOrders.tsx',
    'src/app/pages/Reports.tsx',
    'src/app/pages/TotalOrders.tsx',
    'src/app/pages/TotalSales.tsx'
];

files.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(/'paid'/g, "'fully-paid'");
        content = content.replace(/"paid"/g, '"fully-paid"');
        content = content.replace(/'unpaid'/g, "'downpayment'");
        content = content.replace(/"unpaid"/g, '"downpayment"');
        content = content.replace(/'partial'/g, "'downpayment'");
        content = content.replace(/"partial"/g, '"downpayment"');
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed:', file);
    } catch (e) {
        console.error('Error on file:', file, e.message);
    }
});
