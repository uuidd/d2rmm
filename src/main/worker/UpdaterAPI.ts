import decompress from 'decompress';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'fs';
import path from 'path';
import type { IUpdateInstallerAPI } from 'bridge/UpdateInstallerAPI';
import type { IUpdaterAPI, Update } from 'bridge/Updater';
import { CURRENT_VERSION, compareVersions } from '../version';
import { getExecutablePath, getIsPackaged, getTempPath } from './AppInfoAPI';
import { BroadcastAPI } from './BroadcastAPI';
import { consumeAPI, provideAPI } from './IPC';
import { FileDestination, StringDestination, fetch } from './NetworkFetch';

const UpdateInstallerAPI =
  consumeAPI<IUpdateInstallerAPI>('UpdateInstallerAPI');

const UPDATE_REPO_PATH =
  'https://api.github.com/repos/olegbl/d2rmm/releases/latest';

type Asset = {
  name: string;
  browser_download_url: string;
};

type Release = {
  assets: Asset[];
  tag_name: string;
};

export async function initUpdaterAPI(): Promise<void> {
  provideAPI('UpdaterAPI', {
    installUpdate: async (update: Update): Promise<void> => {
      await installUpdate(update);
    },
    getLatestUpdate: async (): Promise<Update | null> => {
      return await getUpdate();
    },
  } as IUpdaterAPI);
}

async function getUpdate(): Promise<Update | null> {
  if (!getIsPackaged()) {
    return null;
  }

  const response = await fetch(UPDATE_REPO_PATH, new StringDestination());
  const release = response.toJSON<Release>();
  const releaseVersion = release.tag_name.replace(/^v/, '');

  if (compareVersions(CURRENT_VERSION, releaseVersion) > 0) {
    const asset = release.assets.find((asset) => asset.name.endsWith('.zip'));
    if (asset != null) {
      console.log('[Updater] New version available:', releaseVersion);
      return {
        version: releaseVersion,
        url: asset.browser_download_url,
      };
    }
  }

  console.log('[Updater] No updates available.');
  return null;
}

export async function installUpdate(update: Update): Promise<void> {
  const config = await getConfig();
  await cleanupUpdate(config);
  await downloadUpdate(config, update);
  await extractUpdate(config);
  await applyUpdate(config, update);
}

type Config = {
  updateZipPath: string;
  updateDirPath: string;
  updateScriptPath: string;
};

async function getConfig(): Promise<Config> {
  const tempDirPath = getTempPath();
  const updateZipPath = path.join(tempDirPath, 'update.zip');
  const updateDirPath = path.join(tempDirPath, 'update');
  // const updateScriptPath = path.join(tempDirPath, 'update.js');
  const updateScriptPath = path.join(tempDirPath, 'update.ps1');
  return {
    updateZipPath,
    updateDirPath,
    updateScriptPath,
  };
}

async function cleanupUpdate({
  updateZipPath,
  updateDirPath,
  updateScriptPath,
}: Config): Promise<void> {
  console.log('[Updater] Cleaning up temporary directory');
  await BroadcastAPI.send('updater', { type: 'cleanup' });
  if (existsSync(updateZipPath)) {
    rmSync(updateZipPath);
  }
  if (existsSync(updateScriptPath)) {
    rmSync(updateScriptPath);
  }
  if (existsSync(updateDirPath) && statSync(updateDirPath).isDirectory()) {
    rmSync(updateDirPath, { recursive: true });
  }
}

async function downloadUpdate(
  { updateZipPath }: Config,
  update: Update,
): Promise<void> {
  console.log('[Updater] Downloading update');
  await BroadcastAPI.send('updater', { event: 'download' });
  mkdirSync(path.dirname(updateZipPath), { recursive: true });
  await fetch(update.url, new FileDestination(updateZipPath), {
    onProgress: async (bytesDownloaded, bytesTotal) => {
      await BroadcastAPI.send('updater', {
        event: 'download-progress',
        bytesDownloaded,
        bytesTotal,
      });
    },
  });
  console.log(`[Updater] Downloaded update to ${updateZipPath}`);
}

async function extractUpdate({
  updateZipPath,
  updateDirPath,
}: Config): Promise<void> {
  console.log('[Updater] Extracting update');
  await BroadcastAPI.send('updater', { type: 'extract' });
  process.noAsar = true;
  await decompress(updateZipPath, updateDirPath);
  process.noAsar = false;
}

async function applyUpdate(
  { updateDirPath, updateScriptPath }: Config,
  update: Update,
): Promise<void> {
  console.log('[Updater] Applying update');
  await BroadcastAPI.send('updater', { event: 'apply' });
  const appExecutablePath = getExecutablePath();
  const appDirectoryPath = path.dirname(appExecutablePath);
  const updateDirectoryPath = path.join(
    updateDirPath,
    `D2RMM ${update.version}`,
  );

  const updateScriptContent = `
    Echo "Waiting for D2RMM to exit..."
    Start-Sleep -Seconds 1
    Echo "Copying files..."
    Copy-Item -Path "${updateDirectoryPath}\\*" -Destination "${appDirectoryPath}" -Recurse -Force
    Echo "Restarting D2RMM..."
    Start-Sleep -Seconds 1
    Start-Process -FilePath "${appExecutablePath}"
  `;

  writeFileSync(updateScriptPath, updateScriptContent, {
    encoding: 'utf8',
  });

  await UpdateInstallerAPI.quitAndRun(updateScriptPath);
}
