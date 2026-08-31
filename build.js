const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const destDir = path.join(__dirname, 'public');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Interceptor polyfill to make google.script.run calls work on Vercel
const POLYFILL = `
  <!-- Vercel Google Apps Script Polyfill -->
  <script>
  if (typeof google === 'undefined' || !google.script) {
    window.google = {
      script: {
        run: new Proxy({}, {
          get(target, prop) {
            return function(...args) {
              let successHandler = null;
              let failureHandler = null;
              
              const runner = {
                withSuccessHandler(sh) {
                  successHandler = sh;
                  return this;
                },
                withFailureHandler(fh) {
                  failureHandler = fh;
                  return this;
                }
              };
              
              // Delay execution to allow handler chain attachment
              setTimeout(() => {
                fetch('/api/proxy', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    action: prop,
                    arguments: args
                  })
                })
                .then(res => res.json())
                .then(data => {
                  if (data.error) {
                    if (failureHandler) failureHandler(new Error(data.error));
                  } else {
                    if (successHandler) successHandler(data.result);
                  }
                })
                .catch(err => {
                  if (failureHandler) failureHandler(err);
                });
              }, 0);
              
              return runner;
            };
          }
        }),
        url: {
          getLocation(callback) {
            const parsedUrl = new URL(window.location.href);
            const parameter = {};
            parsedUrl.searchParams.forEach((val, key) => {
              parameter[key] = val;
            });
            callback({
              parameter: parameter,
              hash: parsedUrl.hash
            });
          }
        },
        history: {
          replace(state, query, hash) {
            const url = new URL(window.location.href);
            url.search = '';
            url.hash = hash || '';
            Object.keys(query).forEach(key => {
              url.searchParams.set(key, query[key]);
            });
            window.history.replaceState(state, '', url.toString());
          }
        }
      }
    };
  }
  </script>
`;

try {
  // Read CHIS-Phoenix Source Files
  const indexSrc = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
  const transmittalSrc = fs.readFileSync(path.join(srcDir, 'TransmittalModule.html'), 'utf8');
  const styleSrc = fs.readFileSync(path.join(srcDir, 'style.html'), 'utf8');
  const scriptSrc = fs.readFileSync(path.join(srcDir, 'script.html'), 'utf8');
  const tmAssetsSrc = fs.readFileSync(path.join(srcDir, 'TMAssets.html'), 'utf8');

  // 1. Compile index.html
  let indexCompiled = indexSrc;
  
  // Inject Polyfill into <head>
  indexCompiled = indexCompiled.replace('<head>', `<head>\n${POLYFILL}`);
  
  // Replace style include
  indexCompiled = indexCompiled.replace('<?!= include("style"); ?>', `<style>\n${styleSrc}\n</style>`);
  
  // Replace script include
  indexCompiled = indexCompiled.replace('<?!= include("script"); ?>', `<script>\n${scriptSrc}\n</script>`);
  
  // Replace transmittal module URL with relative path
  indexCompiled = indexCompiled.replace(
    'window.CHIS_TRANSMITTAL_MODULE_URL = <?!= transmittalModuleUrlJson ?>;',
    'window.CHIS_TRANSMITTAL_MODULE_URL = "/transmittal";'
  );

  fs.writeFileSync(path.join(destDir, 'index.html'), indexCompiled, 'utf8');
  console.log('Successfully compiled: public/index.html');

  // 2. Compile TransmittalModule.html (transmittal.html)
  let transmittalCompiled = transmittalSrc;
  
  // Inject Polyfill into <head>
  transmittalCompiled = transmittalCompiled.replace('<head>', `<head>\n${POLYFILL}`);
  
  // Replace TMAssets include
  transmittalCompiled = transmittalCompiled.replace('<?!= include(\'TMAssets\'); ?>', `<style>\n${tmAssetsSrc}\n</style>`);

  fs.writeFileSync(path.join(destDir, 'transmittal.html'), transmittalCompiled, 'utf8');
  console.log('Successfully compiled: public/transmittal.html');

} catch (err) {
  console.error('Compilation failed:', err.message);
  process.exit(1);
}
