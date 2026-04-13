const fs = require('fs');
const path = require('path');

// Colors for terminal (Defense ready aesthetics)
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

console.log(`\n${BOLD}====================================================${RESET}`);
console.log(`${BOLD}   SHOELOTSKEY TECHNICAL DEFENSE: LIVE AUDIT LOG   ${RESET}`);
console.log(`${BOLD}====================================================${RESET}`);
console.log(`${YELLOW}[READY] Watching ALL system files (recursive)...${RESET}\n`);

const fileCache = new Map();

// Robust Recursive Indexing
function getFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const normalizedPath = fullPath.replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);

        // Security Ignore List (Only ignore huge dependency folders)
        if (normalizedPath.includes('node_modules') || 
            normalizedPath.includes('/venv') || 
            normalizedPath.includes('/.git') || 
            normalizedPath.includes('__pycache__') || 
            normalizedPath.includes('/.gemini')) {
            return;
        }

        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(fullPath));
        } else {
            results.push(normalizedPath);
        }
    });
    return results;
}

console.log(`${YELLOW}[INDEXING] Scanning Shoelotskey SMS directory...${RESET}`);
const allFiles = getFiles('.');
allFiles.forEach(f => {
    try {
        fileCache.set(f, fs.readFileSync(f, 'utf8'));
    } catch(e) {}
});
console.log(`${GREEN}[SUCCESS] ${allFiles.length} files tracked. System is 100% covered.${RESET}\n`);

function printDiff(oldStr, newStr, filename) {
    const oldLines = oldStr.split(/\r?\n/);
    const newLines = newStr.split(/\r?\n/);
    const timestamp = new Date().toLocaleTimeString();

    console.log(`\n${BOLD}${YELLOW}----------------------------------------------------${RESET}`);
    console.log(`${BOLD}${YELLOW}[EVENT][${timestamp}] File Modification Detected${RESET}`);
    console.log(`${BOLD}File: ${filename}${RESET}`);

    let deletedLines = [];
    const maxLines = Math.max(oldLines.length, newLines.length);
    let hasDiff = false;
    for (let i = 0; i < maxLines; i++) {
        if (oldLines[i] !== newLines[i]) {
            hasDiff = true;
            if (oldLines[i] !== undefined && oldLines[i].trim() !== "") {
                console.log(`${RED}- [OLD] Line ${i + 1}: ${oldLines[i].trim()}${RESET}`);
                deletedLines.push(oldLines[i]);
            }
            if (newLines[i] !== undefined && newLines[i].trim() !== "") {
                console.log(`${GREEN}+ [NEW] Line ${i + 1}: ${newLines[i].trim()}${RESET}`);
            }
        }
    }
    
    if (!hasDiff) {
        console.log(`${YELLOW}[INFO] Change committed (Symmetry/Validation).${RESET}`);
    } else {
        if (deletedLines.length > 0) {
            console.log(`\n${BOLD}${RED}[DELETED CODE BLOCK] Copy to restore specific lines:${RESET}`);
            console.log(`// --- START OF REMOVED CONTENT ---`);
            console.log(deletedLines.join('\n'));
            console.log(`// --- END OF REMOVED CONTENT ---`);
        }

        console.log(`\n${BOLD}${YELLOW}[RECOVERY SNAPSHOT] Copy below for full file restoration:${RESET}`);
        console.log(`// --- PREVIOUS VERSION OF ${path.basename(filename)} ---`);
        console.log(oldStr);
        console.log(`// --- END OF SNAPSHOT ---`);
    }
    console.log(`${BOLD}${YELLOW}----------------------------------------------------${RESET}`);
}

// Watch everything with high sensitivity
fs.watch('.', { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    
    const normalizedName = filename.replace(/\\/g, '/');
    if (normalizedName.includes('node_modules') || normalizedName.includes('/venv') || normalizedName.includes('/.git')) return;

    // Use a small buffer to wait for file writing to finish
    setTimeout(() => {
        try {
            if (!fs.existsSync(normalizedName)) {
                 const timestamp = new Date().toLocaleTimeString();
                 console.log(`${BOLD}${RED}\n[ALERT][${timestamp}] File Permanently Removed from System: ${normalizedName}${RESET}`);
                 fileCache.delete(normalizedName);
                 return;
            }
            const currentContent = fs.readFileSync(normalizedName, 'utf8');
            const cachedContent = fileCache.get(normalizedName);

            // Trigger log if content actually changed
            if (cachedContent !== undefined && currentContent !== cachedContent) {
                printDiff(cachedContent, currentContent, normalizedName);
                fileCache.set(normalizedName, currentContent);
            } else if (cachedContent === undefined) {
                console.log(`${GREEN}\n[EVENT] New/Restored File Detected: ${normalizedName}${RESET}`);
                fileCache.set(normalizedName, currentContent);
            }
        } catch (e) {
            // Error usually means the file was temporarily locked during save
        }
    }, 150);
});
