import { useCallback, useMemo } from 'react';
import { LoadingButton } from '@mui/lab';
import sandbox from './sandbox';
import getModAPI from './getModAPI';
import useToast from './useToast';
import { EnabledMods } from './useEnabledMods';
import { usePreferences } from './Preferences';
import { ILogLevel, useLogger } from './Logs';

const API = window.electron.API;

type Props = {
  enabledMods: EnabledMods;
  orderedMods: Mod[];
  onErrorsEncountered: () => unknown;
};

export default function ModInstallButton({
  enabledMods,
  orderedMods,
  onErrorsEncountered,
}: Props): JSX.Element {
  const showToast = useToast();
  const preferences = usePreferences();
  const logger = useLogger();
  const { gamePath, mergedPath, isPreExtractedData, isDirectMode } =
    preferences;

  const modsToInstall = useMemo(
    () => orderedMods.filter((mod) => enabledMods[mod.id] ?? false),
    [orderedMods, enabledMods]
  );

  const onInstallMods = useCallback((): void => {
    try {
      logger.clear();

      if (!isDirectMode) {
        API.deleteFile(`${mergedPath}\\..`);
        API.createDirectory(mergedPath);
        API.writeJson(`${mergedPath}\\..\\modinfo.json`, {
          name: 'D2RMM',
          savepath: 'D2RMM/',
        });
      }

      if (!isPreExtractedData) {
        API.openStorage(gamePath);
      }

      const extractedFiles = {};

      const modsInstalled = [];
      for (let i = 0; i < modsToInstall.length; i = i + 1) {
        const mod = modsToInstall[i];
        try {
          let errorCount: number = 0;
          const recordLog = (level: ILogLevel, message: string): void => {
            logger.add(
              level,
              `Mod ${mod.info.name} encountered a runtime error! ${message}`
            );
            if (level === 'error') {
              errorCount++;
            }
          };
          const code = API.readModCode(mod.id);
          const api = getModAPI(mod, preferences, extractedFiles, recordLog);
          const installMod = sandbox(code);
          installMod({ D2RMM: api, config: mod.config, Math });
          if (errorCount === 0) {
            modsInstalled.push(mod);
            logger.log(`Mod ${mod.info.name} installed successfully.`);
          }
        } catch (error) {
          logger.error(
            `Mod ${mod.info.name} encountered a compile error! ${String(error)}`
          );
        }
      }

      if (!isPreExtractedData) {
        API.closeStorage();
      }

      if (modsToInstall.length === 0) {
        showToast({
          severity: 'success',
          title: 'No Mods Installed',
        });
      } else if (modsInstalled.length > 0) {
        showToast({
          severity:
            modsInstalled.length < modsToInstall.length ? 'warning' : 'success',
          title: `${modsInstalled.length}/${modsToInstall.length} Mods Installed`,
        });
      }

      if (modsInstalled.length < modsToInstall.length) {
        onErrorsEncountered();
      }
    } catch (error) {
      logger.error(String(error));
      showToast({
        severity: 'error',
        title: 'Error When Installing Mods',
        description: String(error),
      });
      onErrorsEncountered();
    }
  }, [
    logger,
    gamePath,
    isDirectMode,
    isPreExtractedData,
    mergedPath,
    modsToInstall,
    preferences,
    showToast,
    onErrorsEncountered,
  ]);

  return (
    <LoadingButton onClick={onInstallMods} variant="outlined">
      Install Mods
    </LoadingButton>
  );
}
