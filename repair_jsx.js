const fs = require('fs');
const path = 'c:/Users/charm/Downloads/Service Management System/src/app/pages/ServiceIntake.tsx';
let content = fs.readFileSync(path, 'utf8');

// The Goal: Fix the CardContent ending and add the missing </Card>
// Also fix the indentation of Order Summary Section.

// 1. Identify the end of the shoe map cards.
// We look for </CardContent> followed by ))} without </Card>
content = content.replace(/<\/CardContent>[\s\n]+\)\)\}/, '</CardContent></Card>))}');

// 2. Fix indentation of Order Summary Section and following blocks
// We look for excessive indentation (28 spaces or more) and reduce it.
content = content.replace(/                <Card className="border-gray-200 shadow-sm bg-white overflow-hidden">/g, '            <Card className="border-gray-200 shadow-sm bg-white overflow-hidden">');

// Actually, I'll just use a more surgical replacement for the specific block I know is broken.
// I'll look for the pattern:
// </CardContent>
// ))}
// (many spaces) {/* Order Summary Section */}

const brokenPattern = /<\/CardContent>[\s\n]+\)\)\}[\s\n]+\{\/\* Order Summary Section \*\/\}/;
if (brokenPattern.test(content)) {
    console.log('Found broken pattern');
} else {
    console.log('Broken pattern not found with simple regex');
}

fs.writeFileSync(path, content);
console.log('File updated');
