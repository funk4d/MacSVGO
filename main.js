const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { optimize } = require('svgo');

let mainWindow;

function createWindow() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'resources', 'icon.png'));
  app.dock.setIcon(icon);

  mainWindow = new BrowserWindow({
    width: 800,
    height: 560,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#fafafa',
    icon: path.join(__dirname, 'resources', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function buildSvgoConfig(settings) {
  const floatPrecision = Number(settings.floatPrecision);
  const transformPrecision = Number(settings.transformPrecision);
  const plugins = [];

  for (const [name, enabled] of Object.entries(settings.plugins)) {
    if (!enabled) continue;

    const plugin = { name, params: {} };

    // Match SVGOMG: 0 breaks cleanupNumericValues, use 1 instead
    plugin.params.floatPrecision =
      name === 'cleanupNumericValues' && floatPrecision === 0
        ? 1
        : floatPrecision;

    plugin.params.transformPrecision = transformPrecision;

    plugins.push(plugin);
  }

  return {
    multipass: settings.multipass,
    plugins,
  };
}

function optimizeSvgFiles(inputPaths, outputDir, settings) {
  const optimizedDir = path.join(outputDir, 'optimized');
  if (!fs.existsSync(optimizedDir)) {
    fs.mkdirSync(optimizedDir, { recursive: true });
  }

  const config = buildSvgoConfig(settings);
  const results = [];

  for (const filePath of inputPaths) {
    const fileName = path.basename(filePath);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const originalSize = Buffer.byteLength(content, 'utf-8');
      const result = optimize(content, config);
      const optimizedSize = Buffer.byteLength(result.data, 'utf-8');

      fs.writeFileSync(path.join(optimizedDir, fileName), result.data, 'utf-8');

      results.push({
        name: fileName,
        originalSize,
        optimizedSize,
        saved: originalSize - optimizedSize,
      });
    } catch (err) {
      results.push({
        name: fileName,
        error: err.message,
      });
    }
  }
  return results;
}

ipcMain.handle('select-folder', async (_event, settings) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select folder with SVG files',
    properties: ['openDirectory'],
  });
  if (canceled || filePaths.length === 0) return null;

  const folderPath = filePaths[0];
  const svgFiles = fs.readdirSync(folderPath)
    .filter((f) => f.toLowerCase().endsWith('.svg'))
    .map((f) => path.join(folderPath, f));

  if (svgFiles.length === 0) {
    return { error: 'No .svg files found in the selected folder.' };
  }

  const results = optimizeSvgFiles(svgFiles, folderPath, settings);
  return { outputDir: path.join(folderPath, 'optimized'), results };
});

ipcMain.handle('optimize-dropped-files', async (_event, filePaths, settings) => {
  const { canceled, filePaths: destPaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Save optimized SVGs',
    message: 'Choose a folder to save the optimized SVG files.\nFiles will be saved into an "optimized" subfolder.',
    buttonLabel: 'Save Here',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled || destPaths.length === 0) return null;

  const outputDir = destPaths[0];
  const results = optimizeSvgFiles(filePaths, outputDir, settings);
  return { outputDir: path.join(outputDir, 'optimized'), results };
});
