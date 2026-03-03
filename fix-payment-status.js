const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/charm/Downloads/Service Management System/src';
function walkFiles(d, callback) {
    let list = fs.readdirSync(d);
    list.forEach(f => {
        let dirPath = path.join(d, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkFiles(dirPath, callback) : callback(path.join(d, f));
    });
}

const map = [
    [/'paid'/g, "'fully-paid'"],
    [/"paid"/g, '"fully-paid"'],
    [/'partial'/g, "'downpayment'"],
    [/"partial"/g, '"downpayment"'],
    [/'unpaid'/g, "'downpayment'"],
    [/"unpaid"/g, '"downpayment"'],
    [/>Unpaid</g, ">Downpayment<"],
    [/>Paid</g, ">Fully Paid<"],
    [/>Partial</g, ">Downpayment<"]
];

walkFiles(dir, function (filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;

        for (let [pattern, repl] of map) {
            content = content.replace(pattern, repl);
        }

        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Fixed:', filePath);
        }
    }
});
