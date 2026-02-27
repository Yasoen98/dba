import fs from 'fs';

let tsData = fs.readFileSync('src/data/characters.ts', 'utf8');
if (!fs.existsSync('public/assets/skills')) fs.mkdirSync('public/assets/skills', { recursive: true });

function generateSVG(name, color, type) {
    let initials = name.split(' ').map(n => n.trim()[0]).filter(n => n && n.match(/[A-Za-z0-9]/)).join('').substring(0, 2).toUpperCase();
    if (!initials) initials = 'XX';
    if (initials.length === 1) initials = name.substring(0, 2).toUpperCase();

    const rx = type === 'char' ? 128 : 48;
    return `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="#222"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="${rx}" fill="url(#g)" stroke="#ffffff" stroke-width="8" stroke-opacity="0.3"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-size="80" font-weight="900" fill="#fff" style="text-shadow: 2px 4px 6px rgba(0,0,0,0.8);">${initials}</text>
</svg>`;
}

// Split data into blocks starting with "    {"
let blocks = tsData.split(/(?=\n\s*{\n\s*id:\s*'[^']+',)/);

for (let i = 1; i < blocks.length; i++) {
    let block = blocks[i];
    let idMatch = block.match(/id:\s*'([^']+)'/);
    let nameMatch = block.match(/name:\s*'([^']+)'/);
    let colorMatch = block.match(/imageColor:\s*'([^']+)'/);

    if (idMatch && nameMatch && colorMatch) {
        let cid = idMatch[1];
        let cname = nameMatch[1];
        let ccolor = colorMatch[1];

        let png = `public/assets/characters/${cid}.png`;
        let svg = `public/assets/characters/${cid}.svg`;

        if (!fs.existsSync(png) && !fs.existsSync(svg)) {
            fs.writeFileSync(svg, generateSVG(cname, ccolor, 'char'));
            // replace portraitUrl line
            block = block.replace(new RegExp(`portraitUrl:\\s*'/assets/characters/${cid}\\.png'`), `portraitUrl: '/assets/characters/${cid}.svg'`);
            block = block.replace(new RegExp(`portraitUrl:\\s*'/assets/characters/${cid}\\.svg'`), `portraitUrl: '/assets/characters/${cid}.svg'`); // ensure valid if it was generated
        }

        // Add iconUrl to techniques
        block = block.replace(/(\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',[\s\S]*?description:\s*'[^']+')/g, (match, prefix, sid, sname) => {
            if (match.includes('iconUrl:')) return match;
            let spath = `public/assets/skills/${cid}_${sid}.svg`;
            fs.writeFileSync(spath, generateSVG(sname, ccolor, 'skill'));
            return match + `,\n                iconUrl: '/assets/skills/${cid}_${sid}.svg'`;
        });

        // Add iconUrl to dodging
        block = block.replace(/(dodge:\s*\{\s*name:\s*'([^']+)',[\s\S]*?description:\s*'[^']+')/g, (match, prefix, dname) => {
            if (match.includes('iconUrl:')) return match;
            let spath = `public/assets/skills/${cid}_dodge.svg`;
            fs.writeFileSync(spath, generateSVG(dname, ccolor, 'skill'));
            return match + `,\n            iconUrl: '/assets/skills/${cid}_dodge.svg'`;
        });

        blocks[i] = block;
    }
}

fs.writeFileSync('src/data/characters.ts', blocks.join(''));
console.log('Placeholders created and characters.ts updated!');
