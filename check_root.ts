import fs from 'fs';

function scan(dir: string) {
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const full = `${dir}/${file}`;
      const stat = fs.statSync(full);
      if (stat.isFile() && (file.endsWith('.txt') || file.endsWith('.zip') || stat.size > 50000)) {
        console.log(`FILE: ${full} (${stat.size} bytes)`);
      }
    }
  } catch (e) {}
}

scan('/root');
scan('/root/.npm');
scan('/tmp');
scan('/app');
scan('/home');
