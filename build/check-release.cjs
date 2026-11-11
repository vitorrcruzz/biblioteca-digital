const fs = require('node:fs');
const path = require('node:path');

function validateRelease({ pkg, lock, gradle, update, metadata }, options = {}) {
  const errors = [];
  const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const version = gradle.match(/^\s*versionName\s+"([^"]+)"/m)?.[1];
  const build = Number(gradle.match(/^\s*versionCode\s+(\d+)\s*$/m)?.[1]);
  if (!versionPattern.test(pkg.version)) errors.push('package.json deve usar X.Y.Z.');
  if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) {
    errors.push('package.json e package-lock.json possuem versões diferentes.');
  }
  if (!versionPattern.test(version)) errors.push('versionName do Android deve usar X.Y.Z.');
  if (!Number.isSafeInteger(build) || build < 1 || build > 2100000000) errors.push('versionCode inválido.');
  if (!Number.isSafeInteger(update.latestBuild) || update.latestBuild < 1 || !versionPattern.test(update.latestVersion)) {
    errors.push('Versão/build inválidos em android-update.json.');
  }
  if (typeof update.enabled !== 'boolean') errors.push('enabled deve ser booleano.');
  if (update.latestBuild > build) errors.push('O aviso aponta para um build posterior ao código local.');
  if (update.latestBuild === build && update.latestVersion !== version) errors.push('Mesmo build com nomes de versão diferentes no Android e no aviso.');
  try {
    const url = new URL(update.downloadUrl);
    if (url.protocol !== 'https:' || !url.pathname.endsWith('/biblioteca-digital.apk')) throw new Error();
  } catch { errors.push('downloadUrl deve apontar para biblioteca-digital.apk por HTTPS.'); }
  if (options.previousBuild !== undefined && (!Number.isSafeInteger(options.previousBuild) || options.previousBuild < 1 || build <= options.previousBuild)) {
    errors.push('O versionCode deve superar o último build distribuído informado.');
  }
  if (options.publishReady) {
    if (options.previousBuild === undefined) errors.push('Informe --previous-build com o maior código já distribuído.');
    if (update.latestBuild !== build || update.latestVersion !== version) errors.push('Antes de divulgar, alinhe o aviso à versão/build do APK publicado.');
  }
  if (metadata) {
    const elements = metadata.elements || [];
    if (metadata.variantName !== 'release' || elements.length !== 1 ||
      elements[0].versionCode !== build || elements[0].versionName !== version ||
      elements[0].outputFile !== 'app-release.apk') errors.push('Metadados do APK não correspondem à versão release do Gradle.');
  }
  return { errors, version, build };
}

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..');
    const args = process.argv.slice(2);
    const options = {};
    let metadataPath;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--publish-ready') options.publishReady = true;
      else if (args[i] === '--previous-build' && args[i + 1]) options.previousBuild = Number(args[++i]);
      else if (args[i] === '--metadata' && args[i + 1]) metadataPath = args[++i];
      else throw new Error(`Argumento inválido: ${args[i]}`);
    }
    const json = file => JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8').replace(/^\uFEFF/, ''));
    const result = validateRelease({
      pkg: json('package.json'), lock: json('package-lock.json'),
      gradle: fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8'),
      update: json('public/android-update.json'), metadata: metadataPath ? json(metadataPath) : undefined,
    }, options);
    if (result.errors.length) throw new Error(result.errors.join('\n'));
    console.log(`Versões coerentes. Android ${result.version} (build ${result.build}); tag: android-v${result.version}.`);
    console.log('Verificação local: não confirma upload, assinatura ou versão instalada em produção.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { validateRelease };
