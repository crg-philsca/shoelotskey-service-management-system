const fs = require('fs');
const path = require('path');

// Colors for terminal
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

console.log(`\n${BOLD}====================================================${RESET}`);
console.log(`${BOLD}   SHOELOTSKEY TECHNICAL DEFENSE: LIVE AUDIT LOG   ${RESET}`);
console.log(`${BOLD}====================================================${RESET}`);
console.log(`${YELLOW}[READY] Watching for code changes and security patches...${RESET}\n`);

// Keep track of file contents to detect diffs
const fileCache = new Map();

function getFiles(dir, files_) {
    files_ = files_ || [];
    const files = fs.readdirSync(dir);
    for (const i in files) {
        const name = dir + '/' + files[i];
        if (fs.statSync(name).isDirectory()) {
            if (!name.includes('node_modules') && !name.includes('.git') && !name.includes('venv') && !name.includes('__pycache__')) {
                getFiles(name, files_);
            }
        } else {
            if (name.endsWith('.tsx') || name.endsWith('.ts') || name.endsWith('.css') || name.endsWith('.py')) {
                files_.push(name);
            }
        }
    }
    return files_;
}

// Initialize cache
console.log(`${YELLOW}[INDEXING] Pre-loading system files for real-time comparison...${RESET}`);
const allFiles = getFiles('.');
allFiles.forEach(file => {
    try {
        fileCache.set(file, fs.readFileSync(file, 'utf8'));
    } catch(e) {}
});
console.log(`${GREEN}[SUCCESS] ${allFiles.length} files cached. Audit system armed.${RESET}\n`);

// Simple line-by-line diff
function printDiff(oldStr, newStr, filename) {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    const timestamp = new Date().toLocaleTimeString();

    console.log(`\n${BOLD}${YELLOW}[EVENT][${timestamp}] File Modified: ${path.basename(filename)}${RESET}`);
    console.log(`${YELLOW}Path: ${filename}${RESET}`);

    // Simplified diff: Show changed lines only
    let hasDiff = false;
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
        if (oldLines[i] !== newLines[i]) {
            hasDiff = true;
            if (oldLines[i] !== undefined) {
                console.log(`${RED}- [ORIGINAL] Line ${i + 1}: ${oldLines[i].trim()}${RESET}`);
            }
            if (newLines[i] !== undefined) {
                console.log(`${GREEN}+ [REVISED ] Line ${i + 1}: ${newLines[i].trim()}${RESET}`);
            }
        }
    }
    
    if (!hasDiff) {
        console.log(`${YELLOW}[NOTE] Trivial change detected (whitespace or encoding).${RESET}`);
    }
}

// Watch directory recursively
fs.watch('.', { recursive: true }, (eventType, filename) => {
    if (!filename) return;

    // Filter out irrelevant files
    if (filename.includes('node_modules') || filename.includes('.git') || filename.includes('venv') || filename.includes('__pycache__')) return;
    if (!filename.endsWith('.tsx') && !filename.endsWith('.ts') && !filename.endsWith('.css') && !filename.endsWith('.py')) return;

    const fullPath = filename.replace(/\\/g, '/');
    
    // Slight delay to ensure file write is complete
    setTimeout(() => {
        try {
            const currentContent = fs.readFileSync(fullPath, 'utf8');
            const cachedContent = fileCache.get(fullPath);

            if (cachedContent !== undefined && currentContent !== cachedContent) {
                printDiff(cachedContent, currentContent, fullPath);
                fileCache.set(fullPath, currentContent); // Update cache
            } else if (cachedContent === undefined) {
                console.log(`${GREEN}[EVENT] New File Created: ${filename}${RESET}`);
                fileCache.set(fullPath, currentContent);
            }
        } catch (e) {
            // File might have been deleted
        }
    }, 100);
});
